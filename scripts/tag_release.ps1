param (
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# Verify that 'svu' is installed and accessible in PATH
if (-not (Get-Command "svu" -ErrorAction SilentlyContinue)) {
    Write-Host "`n[ERROR] 'svu' (Semantic Version Util) was not found in your PATH." -ForegroundColor Red
    Write-Host "svu is required to parse conventional commits and calculate releases.`n" -ForegroundColor Yellow
    exit 1
}

# Get current tag (suppressing stderr if repository has no tags yet)
$currentTag = (svu current 2>$null)
if (-not $currentTag) {
    $currentTag = "none"
}

# Calculate next tag
try {
    $nextTag = (svu next 2>$null).Trim()
} catch {
    Write-Host "[ERROR] Failed to calculate next version using svu." -ForegroundColor Red
    exit 1
}

# Check if any version-bumping commits exist
if ($nextTag -eq $currentTag -or -not $nextTag) {
    Write-Host "Current tag: $currentTag" -ForegroundColor Cyan
    Write-Host "No conventional commits found that require a version bump." -ForegroundColor Yellow
    exit 0
}

Write-Host "----------------------------------------" -ForegroundColor DarkGray
Write-Host "Current Version: $currentTag" -ForegroundColor Cyan
Write-Host "Calculated Tag:  $nextTag" -ForegroundColor Green
Write-Host "----------------------------------------" -ForegroundColor DarkGray

# Check for dry run
if ($DryRun) {
    Write-Host "Dry run mode: Exiting without creating or pushing tag."
    exit 0
}

# Create annotated git tag
Write-Host "Creating git tag $nextTag..." -ForegroundColor Cyan
git tag -a "$nextTag" -m "Release $nextTag"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to create git tag $nextTag." -ForegroundColor Red
    exit $LASTEXITCODE
}

# Push tag to remote
Write-Host "Pushing $nextTag to origin..." -ForegroundColor Cyan
git push origin "$nextTag"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to push tag $nextTag to origin. Rolling back local tag..." -ForegroundColor Red
    git tag -d "$nextTag"
    exit $LASTEXITCODE
}

Write-Host "`nSuccessfully pushed $nextTag!" -ForegroundColor Green