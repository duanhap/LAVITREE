package com.ptit.lavitree

import androidx.compose.runtime.*
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
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
                    onNavigateToHistory = { /* Navigate to history */ }
                )
            }
            composable("scan") {
                ScanScreen(
                    onBack = { navController.popBackStack() },
                    onDiagnoseComplete = { recordId ->
                        navController.navigate("result/$recordId")
                    }
                )
            }
        }
    }
}
