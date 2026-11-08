package com.ptit.lavitree.ui.screens.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ptit.lavitree.data.model.ChatMessageItem
import com.ptit.lavitree.ui.theme.ForestGreen
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    initialDiseaseCode: String? = null,
    onBack: () -> Unit
) {
    val listState = rememberLazyListState()
    val coroutineScope = rememberCoroutineScope()

    var inputText by remember { mutableStateOf("") }
    var location by remember { mutableStateOf("Hà Nam") }
    var harvestDaysLeft by remember { mutableStateOf<Int?>(null) }
    var diseaseCode by remember { mutableStateOf(initialDiseaseCode) }

    val messages = remember {
        mutableStateListOf(
            ChatMessageItem(
                id = "welcome",
                isUser = false,
                text = "Chào bà con! Tôi là Trợ lý Cây trồng Lavi. Tôi có thể hỗ trợ bà con tra cứu bệnh cây, phân tích thời tiết mưa rửa trôi, đề xuất thuốc theo quy định và kiểm tra thời gian cách ly an toàn (PHI).",
                citations = emptyList()
            )
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                "Trợ lý Cây trồng Lavi",
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Surface(
                                color = ForestGreen.copy(alpha = 0.15f),
                                shape = RoundedCornerShape(4.dp)
                            ) {
                                Text(
                                    "AI Khuyến nông",
                                    color = ForestGreen,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                                )
                            }
                        }
                        Text(
                            "ReAct Loop • Cảnh báo mưa & An toàn PHI",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.outline
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(imageVector = Icons.Default.ArrowBack, contentDescription = "Quay lại")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Thanh ngữ cảnh bệnh cây
            if (!diseaseCode.isNullOrEmpty()) {
                Surface(
                    color = ForestGreen.copy(alpha = 0.08f),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "Ngữ cảnh: $diseaseCode",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = ForestGreen
                        )
                        TextButton(
                            onClick = { diseaseCode = null },
                            contentPadding = PaddingValues(0.dp)
                        ) {
                            Text("Bỏ ngữ cảnh", fontSize = 11.sp, color = Color.Gray)
                        }
                    }
                }
            }

            // Danh sách tin nhắn
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                items(messages, key = { it.id }) { msg ->
                    ChatBubbleItem(message = msg)
                }
            }

            // Gợi ý câu hỏi nhanh
            if (messages.size <= 1) {
                LazyRow(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    val quickQuestions = listOf(
                        "Thời tiết hôm nay có mưa không?",
                        "Bệnh sương mai cà chua xử lý thế nào?",
                        "Khoảng cách ly PHI của thuốc?",
                        "Chế phẩm sinh học đối kháng nấm?"
                    )
                    items(quickQuestions) { q ->
                        OutlinedButton(
                            onClick = {
                                inputText = q
                            },
                            shape = RoundedCornerShape(16.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Text(q, fontSize = 12.sp)
                        }
                    }
                }
            }

            // Thanh nhập câu hỏi
            Surface(
                tonalElevation = 3.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = inputText,
                        onValueChange = { inputText = it },
                        placeholder = { Text("Hỏi về bệnh cây, thời tiết, thuốc...", fontSize = 13.sp) },
                        modifier = Modifier.weight(1f),
                        maxLines = 3,
                        shape = RoundedCornerShape(20.dp)
                    )

                    Spacer(modifier = Modifier.width(8.dp))

                    IconButton(
                        onClick = {
                            val textToSend = inputText.trim()
                            if (textToSend.isNotEmpty()) {
                                messages.add(
                                    ChatMessageItem(
                                        id = "user_${System.currentTimeMillis()}",
                                        isUser = true,
                                        text = textToSend
                                    )
                                )
                                inputText = ""
                                coroutineScope.launch {
                                    listState.animateScrollToItem(messages.size - 1)
                                }

                                // Bản khung (A04): Android chưa đọc stream SSE từ Agent (làm ở TASK-10 Sprint 3).
                                // Không giả lập câu trả lời hay trích dẫn: nông dân có thể làm theo nội dung giả,
                                // và trích dẫn bịa gán sai nguồn cho cơ quan thật.
                                messages.add(
                                    ChatMessageItem(
                                        id = "ai_${System.currentTimeMillis()}",
                                        isUser = false,
                                        text = "Trợ lý trên ứng dụng Android chưa được kết nối. Bà con vui lòng dùng mục Trợ lý trên trang web Lavitree để được tư vấn.",
                                        citations = emptyList()
                                    )
                                )
                            }
                        },
                        enabled = inputText.isNotBlank(),
                        modifier = Modifier
                            .size(44.dp)
                            .background(
                                if (inputText.isNotBlank()) ForestGreen else Color.LightGray,
                                CircleShape
                            )
                    ) {
                        Icon(
                            imageVector = Icons.Default.Send,
                            contentDescription = "Gửi",
                            tint = Color.White,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun ChatBubbleItem(message: ChatMessageItem) {
    if (message.isUser) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.End
        ) {
            Surface(
                color = ForestGreen,
                shape = RoundedCornerShape(16.dp, 16.dp, 2.dp, 16.dp),
                modifier = Modifier.widthIn(max = 280.dp)
            ) {
                Text(
                    text = message.text,
                    color = Color.White,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(12.dp)
                )
            }
        }
    } else {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Start
        ) {
            Surface(
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                shape = RoundedCornerShape(16.dp, 16.dp, 16.dp, 2.dp),
                modifier = Modifier
                    .widthIn(max = 320.dp)
                    .border(
                        1.dp,
                        MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f),
                        RoundedCornerShape(16.dp, 16.dp, 16.dp, 2.dp)
                    )
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    // Header AI
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(bottom = 6.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.AutoAwesome,
                            contentDescription = null,
                            tint = ForestGreen,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            "Trợ lý Lavi",
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 12.sp,
                            color = ForestGreen
                        )
                    }

                    // Cảnh báo Bản nháp
                    if (message.isDraft) {
                        Surface(
                            color = Color(0xFFFFF3CD),
                            shape = RoundedCornerShape(6.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Warning,
                                    contentDescription = null,
                                    tint = Color(0xFF856404),
                                    modifier = Modifier.size(14.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    "Bản nháp — Cần chuyên gia xác nhận",
                                    fontSize = 11.sp,
                                    color = Color(0xFF856404),
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    }

                    // Nội dung câu trả lời
                    Text(
                        text = message.text,
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onSurface,
                        lineHeight = 20.sp
                    )

                    // Khối Nguồn tham khảo (Điều 25 Luật SHTT)
                    if (message.citations.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Divider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                        Spacer(modifier = Modifier.height(6.dp))

                        Text(
                            "Nguồn tham khảo:",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.outline
                        )

                        message.citations.forEach { cit ->
                            Surface(
                                color = MaterialTheme.colorScheme.surface,
                                shape = RoundedCornerShape(6.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 4.dp)
                            ) {
                                Column(modifier = Modifier.padding(6.dp)) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Text(
                                            cit.sourceTitle ?: "Tài liệu khuyến nông",
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Medium,
                                            color = MaterialTheme.colorScheme.onSurface,
                                            modifier = Modifier.weight(1f)
                                        )
                                        Surface(
                                            color = if (cit.isVerbatim) ForestGreen.copy(alpha = 0.15f) else Color.LightGray.copy(alpha = 0.3f),
                                            shape = RoundedCornerShape(4.dp)
                                        ) {
                                            Text(
                                                if (cit.isVerbatim) "Trích nguyên văn" else "Tóm tắt",
                                                fontSize = 9.sp,
                                                color = if (cit.isVerbatim) ForestGreen else Color.DarkGray,
                                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                                            )
                                        }
                                    }
                                    if (!cit.excerpt.isNullOrEmpty()) {
                                        Text(
                                            "\"${cit.excerpt}\"",
                                            fontSize = 10.sp,
                                            color = MaterialTheme.colorScheme.outline,
                                            modifier = Modifier.padding(top = 2.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
