# 定时任务调用：有变更则 add → commit → push；无变更则退出 0。
# 用法：powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\scheduled-git-commit.ps1
# 可选：-RepoRoot "E:\kefu\2.0"

param(
    [string] $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $RepoRoot

if (Test-Path (Join-Path $RepoRoot '.git\MERGE_HEAD')) {
    Write-Warning '存在未完成的合并，跳过提交。'
    exit 2
}
if (Test-Path (Join-Path $RepoRoot '.git\rebase-merge')) {
    Write-Warning '存在未完成的 rebase，跳过提交。'
    exit 2
}

$dirty = git status --porcelain
if (-not $dirty) {
    Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') 工作区无变更，跳过。"
    exit 0
}

git add -A
$staged = git diff --cached --name-only
if (-not $staged) {
    Write-Warning '有未忽略变更但未进入暂存区（可能均为忽略文件），跳过提交。'
    exit 0
}

$msg = "chore: 定时提交 $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
git commit -m $msg
if ($LASTEXITCODE -ne 0) {
    Write-Error "git commit 失败（退出码 $LASTEXITCODE）。"
    exit 1
}

git push
if ($LASTEXITCODE -ne 0) {
    Write-Error "git push 失败（退出码 $LASTEXITCODE）。"
    exit 1
}

Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') 已提交并推送。"
exit 0
