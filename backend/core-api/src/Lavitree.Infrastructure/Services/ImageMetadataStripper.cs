using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Lavitree.Infrastructure.Services;

/// <summary>
/// Xóa metadata (EXIF/GPS, XMP, IPTC, comment) khỏi ảnh trước khi lưu vào bucket đọc công khai.
/// Xác định định dạng theo magic bytes, không tin phần mở rộng tệp.
/// Không đổi điểm ảnh. Tệp không phân tích được sẽ ném InvalidDataException để không lưu nhầm ảnh còn GPS.
/// </summary>
public static class ImageMetadataStripper
{
    private static readonly byte[] PngSignature = { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };

    public static async Task<byte[]> StripAsync(Stream input, CancellationToken cancellationToken = default)
    {
        using var buffer = new MemoryStream();
        await input.CopyToAsync(buffer, cancellationToken);
        return Strip(buffer.ToArray());
    }

    public static byte[] Strip(byte[] data)
    {
        try
        {
            if (data.Length >= 2 && data[0] == 0xFF && data[1] == 0xD8) return StripJpeg(data);
            if (data.AsSpan().StartsWith(PngSignature)) return StripPng(data);
            if (data.Length >= 12 && Ascii(data, 0, 4) == "RIFF" && Ascii(data, 8, 4) == "WEBP") return StripWebp(data);
            if (data.Length >= 2 && data[0] == 0x42 && data[1] == 0x4D) return data; // BMP không có vùng metadata
        }
        catch (Exception ex) when (ex is IndexOutOfRangeException or ArgumentException or OverflowException)
        {
            throw new InvalidDataException("Cấu trúc tệp ảnh bị lỗi.", ex);
        }

        throw new InvalidDataException("Định dạng ảnh không được hỗ trợ.");
    }

    private static string Ascii(byte[] data, int offset, int count) => Encoding.ASCII.GetString(data, offset, count);

    private static byte[] StripJpeg(byte[] data)
    {
        using var output = new MemoryStream(data.Length);
        output.Write(data, 0, 2);
        var pos = 2;
        var inScan = false;

        while (pos < data.Length)
        {
            if (data[pos] != 0xFF)
            {
                if (!inScan) throw new InvalidDataException("JPEG thiếu marker hợp lệ.");
                output.WriteByte(data[pos++]); // Dữ liệu nén của scan
                continue;
            }

            var markerStart = pos;
            while (pos < data.Length && data[pos] == 0xFF) pos++; // Bỏ qua các byte đệm 0xFF
            if (pos >= data.Length) throw new InvalidDataException("JPEG bị cắt cụt.");
            var marker = data[pos++];

            if (marker == 0x00 || (marker >= 0xD0 && marker <= 0xD7) || marker == 0x01)
            {
                output.Write(data, markerStart, pos - markerStart); // Byte nhồi, RSTn, TEM không có độ dài
                continue;
            }

            if (marker == 0xD9)
            {
                output.WriteByte(0xFF);
                output.WriteByte(0xD9);
                return output.ToArray(); // Bỏ phần đuôi: ảnh phụ và motion photo có thể mang EXIF riêng
            }

            if (pos + 2 > data.Length) throw new InvalidDataException("JPEG bị cắt cụt.");
            var length = (data[pos] << 8) | data[pos + 1];
            if (length < 2 || pos + length > data.Length) throw new InvalidDataException("Độ dài segment JPEG không hợp lệ.");

            if (!IsRemovableJpegSegment(marker))
            {
                output.WriteByte(0xFF);
                output.WriteByte(marker);
                output.Write(data, pos, length);
            }

            pos += length;
            if (marker == 0xDA) inScan = true;
        }

        throw new InvalidDataException("JPEG thiếu marker kết thúc.");
    }

    // Giữ APP0 (JFIF), APP2 (ICC) và APP14 (Adobe) vì ảnh hưởng tới màu. Xóa các APP còn lại và COM.
    private static bool IsRemovableJpegSegment(byte marker) =>
        marker == 0xFE || (marker >= 0xE1 && marker <= 0xEF && marker != 0xE2 && marker != 0xEE);

    private static byte[] StripPng(byte[] data)
    {
        using var output = new MemoryStream(data.Length);
        output.Write(PngSignature);
        var pos = PngSignature.Length;

        while (pos + 12 <= data.Length)
        {
            var length = (data[pos] << 24) | (data[pos + 1] << 16) | (data[pos + 2] << 8) | data[pos + 3];
            if (length < 0 || length > data.Length - pos - 12) throw new InvalidDataException("Độ dài chunk PNG không hợp lệ.");

            var type = Ascii(data, pos + 4, 4);
            if (type is not ("eXIf" or "tEXt" or "zTXt" or "iTXt" or "tIME"))
            {
                output.Write(data, pos, length + 12);
            }

            pos += length + 12;
            if (type == "IEND") return output.ToArray();
        }

        throw new InvalidDataException("PNG thiếu chunk IEND.");
    }

    private static byte[] StripWebp(byte[] data)
    {
        const byte vp8xExifFlag = 0x08;
        const byte vp8xXmpFlag = 0x04;

        var riffEnd = (long)BitConverter.ToUInt32(data, 4) + 8;
        if (riffEnd > data.Length) throw new InvalidDataException("Kích thước RIFF không hợp lệ.");

        using var chunks = new MemoryStream(data.Length);
        var pos = 12;
        while (pos + 8 <= riffEnd)
        {
            var type = Ascii(data, pos, 4);
            var size = BitConverter.ToUInt32(data, pos + 4);
            var padded = (long)size + (size & 1);
            if (pos + 8 + padded > riffEnd) throw new InvalidDataException("Độ dài chunk WebP không hợp lệ.");

            if (type is not ("EXIF" or "XMP "))
            {
                var chunkStart = chunks.Position;
                chunks.Write(data, pos, (int)(8 + padded));
                if (type == "VP8X" && size >= 1)
                {
                    var flags = chunks.GetBuffer();
                    flags[chunkStart + 8] &= unchecked((byte)~(vp8xExifFlag | vp8xXmpFlag));
                }
            }

            pos += (int)(8 + padded);
        }

        using var output = new MemoryStream((int)chunks.Length + 12);
        output.Write(data, 0, 4);
        output.Write(BitConverter.GetBytes((uint)(chunks.Length + 4)));
        output.Write(data, 8, 4);
        chunks.Position = 0;
        chunks.CopyTo(output);
        return output.ToArray();
    }
}
