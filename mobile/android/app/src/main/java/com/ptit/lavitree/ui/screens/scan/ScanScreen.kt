package com.ptit.lavitree.ui.screens.scan

import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.ptit.lavitree.data.api.ApiClient
import com.ptit.lavitree.ui.diagnose.ImagePreparation
import com.ptit.lavitree.ui.theme.ForestGreen
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScanScreen(
    onBack: () -> Unit,
    onDiagnoseComplete: (String) -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var selectedImageUri by remember { mutableStateOf<Uri?>(null) }
    var isLoading by remember { mutableStateOf(false) }
    var resultSummary by remember { mutableStateOf<String?>(null) }

    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        selectedImageUri = uri
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Chụp / Khám Lá Cây", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(imageVector = Icons.Default.ArrowBack, contentDescription = "Quay lại")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Khung ngắm lá cây 15-20cm (Leaf Viewfinder)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .clip(RoundedCornerShape(16.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f))
                    .border(2.dp, ForestGreen.copy(alpha = 0.5f), RoundedCornerShape(16.dp)),
                contentAlignment = Alignment.Center
            ) {
                if (selectedImageUri != null) {
                    AsyncImage(
                        model = selectedImageUri,
                        contentDescription = "Ảnh lá được chọn",
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(24.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.PhotoCamera,
                            contentDescription = "Chụp ảnh",
                            tint = ForestGreen,
                            modifier = Modifier.size(64.dp)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            "Vui lòng chụp cận cảnh vết bệnh trên lá",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Medium,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        // Mẹo ngắm 15-20cm chuẩn nông học
                        Surface(
                            color = ForestGreen.copy(alpha = 0.1f),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Info,
                                    contentDescription = null,
                                    tint = ForestGreen,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    "Khung ngắm: Giữ camera cách lá 15–20cm, đặt vết đốm vào giữa",
                                    fontSize = 11.sp,
                                    color = ForestGreen,
                                    textAlign = TextAlign.Center
                                )
                            }
                        }
                    }
                }
            }

            resultSummary?.let { summary ->
                Spacer(modifier = Modifier.height(12.dp))
                Surface(
                    color = ForestGreen.copy(alpha = 0.08f),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = summary,
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.padding(12.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Các nút thao tác
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = { photoPickerLauncher.launch("image/*") },
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(imageVector = Icons.Default.PhotoLibrary, contentDescription = null)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Chọn ảnh từ máy")
                    }
                }

                Button(
                    onClick = {
                        val uri = selectedImageUri ?: return@Button
                        isLoading = true

                        resultSummary = null
                        coroutineScope.launch {
                            var preparedFile: java.io.File? = null
                            try {
                                // BUG-58: Tiền xử lý xoay EXIF, thu nhỏ 1600px và nén JPEG trước khi gửi
                                preparedFile = withContext(Dispatchers.IO) {
                                    ImagePreparation.prepareImageForUpload(context, uri)
                                }

                                val fileToSend = preparedFile
                                if (fileToSend == null) {
                                    Toast.makeText(context, "Không thể đọc và xử lý tệp ảnh này.", Toast.LENGTH_SHORT).show()
                                    return@launch
                                }

                                val reqFile = fileToSend.asRequestBody("image/jpeg".toMediaTypeOrNull())
                                val body = MultipartBody.Part.createFormData("image", fileToSend.name, reqFile)

                                val response = withContext(Dispatchers.IO) {
                                    ApiClient.service.scanLeaf(body)
                                }

                                val data = response.body()
                                if (response.isSuccessful && data != null) {
                                    // Hiện kết quả ngay trên màn hình: app chưa có màn kết quả riêng (route "result/{id}"),
                                    // và khách vãng lai / ảnh OOD không có diagnosis_id.
                                    resultSummary = buildResultSummary(data)
                                    data.diagnosisId?.let(onDiagnoseComplete)
                                } else {
                                    val err = response.errorBody()?.string()?.take(200) ?: "Lỗi máy chủ"
                                    Toast.makeText(context, "Chẩn đoán thất bại (HTTP ${response.code()}): $err", Toast.LENGTH_LONG).show()
                                }
                            } catch (e: Exception) {
                                Toast.makeText(context, "Lỗi kết nối: ${e.message}", Toast.LENGTH_LONG).show()
                            } finally {
                                // Ảnh đã xử lý chỉ cần cho lần gửi này; không để ảnh vườn tồn trong cache
                                preparedFile?.delete()
                                isLoading = false
                            }
                        }
                    },
                    enabled = selectedImageUri != null && !isLoading,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = ForestGreen)
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(color = MaterialTheme.colorScheme.onPrimary, modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Đang phân tích AI ResNet-18...")
                    } else {
                        Text("Phân Tích AI & Bắt Bệnh")
                    }
                }
            }
        }
    }
}

/**
 * Tóm tắt kết quả theo api-contracts.md Mục 3.1. Không tự suy ra thông tin server không trả về.
 */
private fun buildResultSummary(data: com.ptit.lavitree.data.model.DiagnosisResponse): String {
    val fallback = data.warning ?: "Ảnh không nằm trong phạm vi cây trồng được hỗ trợ. Vui lòng chụp lại lá trong khung ngắm 15–20cm."
    if (data.isOod) return fallback
    val r = data.result ?: return fallback
    val percent = (r.confidence * 100).toInt()
    val lines = mutableListOf(
        "${r.plantName ?: "Cây trồng"}: ${r.diseaseName ?: r.classCode ?: "Chưa xác định"} ($percent%)"
    )
    r.severityLevel?.let { lines.add("Mức độ: $it") }
    (data.warning ?: r.warning)?.let { lines.add("⚠️ $it") }
    if (data.diagnosisId == null) {
        lines.add("Bạn chưa đăng nhập nên ca khám này không được lưu vào Lịch sử.")
    }
    return lines.joinToString("\n")
}
