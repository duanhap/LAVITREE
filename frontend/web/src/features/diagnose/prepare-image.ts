const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.9;

/**
 * Vẽ lại ảnh trước khi tải lên: xoay đúng chiều chụp, thu nhỏ cạnh dài và loại bỏ toàn bộ EXIF/GPS.
 * Nhờ đó ảnh gốc, kết quả AI và Grad-CAM cùng một chiều, và upload nhẹ hơn trên mạng yếu.
 * Trình duyệt không giải mã được ảnh thì gửi tệp gốc để server kiểm tra.
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    );
    if (!blob) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'leaf';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}
