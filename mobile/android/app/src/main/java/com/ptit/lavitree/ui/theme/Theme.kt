package com.ptit.lavitree.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

// =========================================================================
// 4 MÀU TRẠNG THÁI CHẨN ĐOÁN CHO ANDROID (SSOT: ui-ux.md mục 2, 4 & 11)
// =========================================================================
@Immutable
data class LavitreeStatusColors(
    val statusOk: Color = LavitreeStatusOk,
    val statusOkBg: Color = LavitreeStatusOkBg,
    val statusConfusion: Color = LavitreeStatusConfusion,
    val statusConfusionBg: Color = LavitreeStatusConfusionBg,
    val statusUncertain: Color = LavitreeStatusUncertain,
    val statusUncertainBg: Color = LavitreeStatusUncertainBg,
    val statusOod: Color = LavitreeStatusOod,
    val statusOodBg: Color = LavitreeStatusOodBg,
    val info: Color = LavitreeInfo,
    val infoBg: Color = LavitreeInfoBg
)

val LocalLavitreeStatusColors = staticCompositionLocalOf { LavitreeStatusColors() }

// =========================================================================
// BẢNG MÀU MATERIAL 3 CHUẨN HÓA VỚI WEB DESIGN SYSTEM
// =========================================================================
private val LavitreeLightColorScheme = lightColorScheme(
    primary = LavitreePrimary,
    onPrimary = Color.White,
    primaryContainer = LavitreeSecondary,
    onPrimaryContainer = LavitreePrimary,
    surface = LavitreeCard,
    onSurface = LavitreeForeground,
    surfaceVariant = LavitreeSecondary,
    onSurfaceVariant = LavitreeMutedForeground,
    background = LavitreeBackground,
    onBackground = LavitreeForeground,
    outline = LavitreeBorder,
    error = LavitreeDestructive,
    onError = Color.White
)

@Composable
fun LavitreeTheme(
    // Tắt dynamic color và dark mode cho Sprint 2 để tối ưu khả năng đọc ngoài trời nắng (ui-ux.md mục 2 & 11)
    statusColors: LavitreeStatusColors = LavitreeStatusColors(),
    content: @Composable () -> Unit
) {
    CompositionLocalProvider(
        LocalLavitreeStatusColors provides statusColors
    ) {
        MaterialTheme(
            colorScheme = LavitreeLightColorScheme,
            typography = LavitreeTypography,
            content = content
        )
    }
}
