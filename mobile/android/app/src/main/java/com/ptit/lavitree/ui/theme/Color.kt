package com.ptit.lavitree.ui.theme

import androidx.compose.ui.graphics.Color

// =========================================================================
// LAVITREE DESIGN TOKENS (SSOT: docs/architecture/ui-ux.md mục 2 & 11)
// =========================================================================

// Nền & Chữ chính
val LavitreeBackground = Color(0xFFFAFAF7)
val LavitreeCard = Color(0xFFFFFFFF)
val LavitreeForeground = Color(0xFF1C2420)
val LavitreeMutedForeground = Color(0xFF5B6660)
val LavitreeBorder = Color(0xFFE3E6E1)

// Tương tác & Nút bấm
val LavitreePrimary = Color(0xFF2E6B3F)
val LavitreePrimaryHover = Color(0xFF245633)
val LavitreeSecondary = Color(0xFFEEF3EC)
val LavitreeDestructive = Color(0xFFB91C1C)

// 4 Màu trạng thái chẩn đoán (Tách khỏi nút bấm - SSOT: ui-ux.md mục 2 & classes.md mục 4)
val LavitreeStatusOk = Color(0xFF115E59)
val LavitreeStatusOkBg = Color(0xFFCCFBF1)

val LavitreeStatusConfusion = Color(0xFF92400E)
val LavitreeStatusConfusionBg = Color(0xFFFEF3C7)

val LavitreeStatusUncertain = Color(0xFFB91C1C)
val LavitreeStatusUncertainBg = Color(0xFFFEE2E2)

val LavitreeStatusOod = Color(0xFF475569)
val LavitreeStatusOodBg = Color(0xFFF1F5F9)

val LavitreeInfo = Color(0xFF1D4ED8)
val LavitreeInfoBg = Color(0xFFDBEAFE)

// Màu thương hiệu Lavitree (Trang trí / Lavi mascot)
val LavitreeBrandMint = Color(0xFFA6E3CC)
val LavitreeBrandMintSoft = Color(0xFFE6F7F0)
val LavitreeBrandGlow = Color(0xFF5EEAD4)

// =========================================================================
// CÁC BIẾN TƯƠNG THÍCH CHO MÀN HÌNH NGUYÊN MẪU CŨ (HomeScreen, ScanScreen, DiagnosisResultScreen)
// =========================================================================
val ForestGreen = LavitreePrimary
val EmeraldGreen = LavitreePrimaryHover
val LightLeafGreen = LavitreeBrandMint
val LeafBackground = LavitreeBackground

val DangerRed = LavitreeDestructive
val WarningAmber = LavitreeStatusConfusion
val DarkText = LavitreeForeground
val MutedText = LavitreeMutedForeground
