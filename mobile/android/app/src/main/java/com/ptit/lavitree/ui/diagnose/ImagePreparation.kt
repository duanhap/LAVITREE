package com.ptit.lavitree.ui.diagnose

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Tiền xử lý ảnh lá cây trên thiết bị Android trước khi upload lên Core API (Khắc phục triệt để BUG-58):
 * 1. Đọc thẻ EXIF Orientation và xoay đúng chiều chụp (chống ảnh nằm ngang khi chụp dọc).
 * 2. Thu nhỏ cạnh dài tối đa 1600px để tối ưu băng thông di động ngoài đồng ruộng.
 * 3. Nén JPEG chất lượng 90%, loại bỏ toàn bộ tọa độ GPS/EXIF nhạy cảm.
 * Hoàn toàn đồng nhất với logic của `prepare-image.ts` trên Web.
 */
object ImagePreparation {

    private const val MAX_EDGE_PX = 1600
    private const val JPEG_QUALITY = 90

    fun prepareImageForUpload(context: Context, imageUri: Uri): File? {
        return try {
            val contentResolver = context.contentResolver

            // 1. Đọc hướng xoay từ EXIF
            var orientation = ExifInterface.ORIENTATION_NORMAL
            contentResolver.openInputStream(imageUri)?.use { inputStream ->
                val exif = ExifInterface(inputStream)
                orientation = exif.getAttributeInt(
                    ExifInterface.TAG_ORIENTATION,
                    ExifInterface.ORIENTATION_NORMAL
                )
            }

            // 2. Đọc kích thước ảnh để tính inSampleSize (chống OutOfMemory)
            val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            contentResolver.openInputStream(imageUri)?.use { inputStream ->
                BitmapFactory.decodeStream(inputStream, null, options)
            }

            val origWidth = options.outWidth
            val origHeight = options.outHeight
            if (origWidth <= 0 || origHeight <= 0) return null

            var inSampleSize = 1
            val maxEdge = max(origWidth, origHeight)
            if (maxEdge > MAX_EDGE_PX) {
                inSampleSize = (maxEdge.toFloat() / MAX_EDGE_PX).roundToInt()
            }

            // 3. Giải mã Bitmap thực tế
            val decodeOptions = BitmapFactory.Options().apply {
                this.inSampleSize = inSampleSize
            }

            val decodedBitmap: Bitmap? = contentResolver.openInputStream(imageUri)?.use { inputStream ->
                BitmapFactory.decodeStream(inputStream, null, decodeOptions)
            } ?: return null

            // 4. Xoay và Scale chính xác theo EXIF
            val matrix = Matrix()
            when (orientation) {
                ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
                ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
                ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
                ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.postScale(-1f, 1f)
                ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.postScale(1f, -1f)
            }

            val scale = min(1f, MAX_EDGE_PX.toFloat() / max(decodedBitmap.width, decodedBitmap.height))
            if (scale < 1f) {
                matrix.postScale(scale, scale)
            }

            val processedBitmap = Bitmap.createBitmap(
                decodedBitmap,
                0,
                0,
                decodedBitmap.width,
                decodedBitmap.height,
                matrix,
                true
            )

            // 5. Ghi ra tệp tạm JPEG không chứa EXIF nhạy cảm
            val outputFile = File.createTempFile("prepared_leaf_", ".jpg", context.cacheDir)
            FileOutputStream(outputFile).use { outStream ->
                processedBitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, outStream)
                outStream.flush()
            }

            if (processedBitmap != decodedBitmap) {
                processedBitmap.recycle()
            }
            decodedBitmap.recycle()

            outputFile
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }
}
