package com.ptit.lavitree

import androidx.compose.runtime.*
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.ptit.lavitree.ui.screens.chat.ChatScreen
import com.ptit.lavitree.ui.screens.home.HomeScreen
import com.ptit.lavitree.ui.screens.scan.ScanScreen
import com.ptit.lavitree.ui.theme.LavitreeTheme

@Composable
fun LavitreeApp() {
    val navController = rememberNavController()

    LavitreeTheme {
        NavHost(navController = navController, startDestination = "home") {
            composable("home") {
                HomeScreen(
                    onNavigateToScan = { navController.navigate("scan") },
                    onNavigateToHandbook = { /* Navigate to handbook */ },
                    onNavigateToHistory = { /* Navigate to history */ },
                    onNavigateToChat = { navController.navigate("chat") }
                )
            }
            composable("scan") {
                ScanScreen(
                    onBack = { navController.popBackStack() },
                    // Chưa có màn kết quả/lịch sử riêng (TASK-10 Sprint 3): ScanScreen tự hiện kết quả.
                    // Không điều hướng tới route chưa khai báo trong NavHost (sẽ crash IllegalArgumentException).
                    onDiagnoseComplete = { _ -> }
                )
            }
            composable("chat") {
                ChatScreen(
                    onBack = { navController.popBackStack() }
                )
            }
        }
    }
}
