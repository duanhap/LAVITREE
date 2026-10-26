package com.ptit.lavitree.ui.screens.result

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.ptit.lavitree.data.model.DiagnosisResponse
import com.ptit.lavitree.ui.theme.DangerRed
import com.ptit.lavitree.ui.theme.ForestGreen
import com.ptit.lavitree.ui.theme.WarningAmber

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DiagnosisResultScreen(
    result: DiagnosisResponse,
    onBack: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Kết Quả Chẩn Đoán") },
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
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Warning banner if uncertain (< 70%)
            if (result.isUncertain) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = WarningAmber.copy(alpha = 0.2f)),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Warning, contentDescription = null, tint = WarningAmber)
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = result.warningMessage ?: "Độ tin cậy dưới 70%. Khuyên bạn nên chụp lại góc rõ hơn!",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
            }

            // Disease Header Card
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = result.diseaseNameVi,
                        fontSize = 20.sp,
                        style = MaterialTheme.typography.titleLarge,
                        color = if (result.isHealthy) ForestGreen else DangerRed
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(text = "Cây: ${result.plantName} (${result.classCode})", style = MaterialTheme.typography.bodyMedium)
                    Spacer(modifier = Modifier.height(8.dp))
                    LinearProgressIndicator(
                        progress = { result.confidence },
                        modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
                        color = if (result.confidence > 0.7f) ForestGreen else WarningAmber
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Độ tin cậy AI: ${(result.confidence * 100).toInt()}%",
                        style = MaterialTheme.typography.labelSmall
                    )
                }
            }

            // Grad-CAM Heatmap Section
            Text("Vùng Bệnh Phát Hiện (Grad-CAM XAI)", style = MaterialTheme.typography.titleMedium)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    AsyncImage(
                        model = result.originalImageUrl,
                        contentDescription = "Ảnh gốc",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.height(140.dp).fillMaxWidth().clip(RoundedCornerShape(10.dp))
                    )
                    Text("Ảnh chụp gốc", style = MaterialTheme.typography.labelSmall, modifier = Modifier.align(Alignment.CenterHorizontally))
                }
                Column(modifier = Modifier.weight(1f)) {
                    AsyncImage(
                        model = result.gradCamImageUrl ?: result.originalImageUrl,
                        contentDescription = "Bản đồ nhiệt Grad-CAM",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.height(140.dp).fillMaxWidth().clip(RoundedCornerShape(10.dp))
                    )
                    Text("Vùng AI chú ý", style = MaterialTheme.typography.labelSmall, modifier = Modifier.align(Alignment.CenterHorizontally))
                }
            }

            // IPM Treatment & Care Guidelines
            Text("Hướng Dẫn Xử Lý Chuẩn Khuyến Nông (IPM)", style = MaterialTheme.typography.titleMedium)
            result.treatmentSteps.forEach { step ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            text = "Bước ${step.stepOrder}: ${step.actionTitle}",
                            style = MaterialTheme.typography.titleSmall,
                            color = ForestGreen
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(text = step.instructions, style = MaterialTheme.typography.bodySmall)
                        if (!step.isolationDays.isNullOrEmpty()) {
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Thời gian cách ly an toàn (PHI): ${step.isolationDays}",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.outline
                            )
                        }
                    }
                }
            }
        }
    }
}
