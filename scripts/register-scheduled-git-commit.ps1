# 向「任务计划程序」注册定时提交（默认每天 09:00，当前用户登录时运行）。
# 请以当前用户身份在 PowerShell 中执行（通常无需管理员）：
#   powershell -ExecutionPolicy Bypass -File .\scripts\register-scheduled-git-commit.ps1
#
# 参数示例：
#   -DailyAt "18:30"     # 每天该时刻
#   -IntervalHours 4     # 每 N 小时一次（与 -DailyAt 二选一，优先 IntervalHours）

param(
    [string] $DailyAt = '09:00',
    [int] $IntervalHours = 0,
    [string] $TaskName = 'Kefu2.0-Git-ScheduledCommit'
)

$commitScript = Join-Path $PSScriptRoot 'scheduled-git-commit.ps1'
if (-not (Test-Path -LiteralPath $commitScript)) {
    throw "未找到: $commitScript"
}

$arg = "-NoProfile -ExecutionPolicy Bypass -File `"$commitScript`""
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg

if ($IntervalHours -gt 0) {
    $repDur = New-TimeSpan -Days 3650
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
        -RepetitionInterval (New-TimeSpan -Hours $IntervalHours) `
        -RepetitionDuration $repDur
} else {
    $parts = $DailyAt -split ':'
    $h = [int]$parts[0]
    $m = if ($parts.Count -gt 1) { [int]$parts[1] } else { 0 }
    $atToday = (Get-Date).Date.AddHours($h).AddMinutes($m)
    $trigger = New-ScheduledTaskTrigger -Daily -At $atToday
}

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description 'kefu 2.0：定时 git commit + push' -Force | Out-Null
Write-Host "已注册计划任务: $TaskName"
Write-Host '查看/修改：任务计划程序 → 任务计划程序库'
