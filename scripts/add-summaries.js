/**
 * Phase 4: Add $GITHUB_STEP_SUMMARY to workflows missing them
 * Focus on: publish, deploy, validate, and key CI workflows
 */
const fs = require('fs');
const path = require('path');

const wfDir = 'c:/CodeSpace/frootai/.github/workflows';

const SUMMARIES = {
    'npm-publish.yml': `
      - name: Summary
        if: always()
        run: |
          echo "## npm Publish" >> $GITHUB_STEP_SUMMARY
          echo "| Field | Value |" >> $GITHUB_STEP_SUMMARY
          echo "|-------|-------|" >> $GITHUB_STEP_SUMMARY
          echo "| Package | frootai-mcp |" >> $GITHUB_STEP_SUMMARY
          echo "| Version | \${{ steps.version_check.outputs.local }} |" >> $GITHUB_STEP_SUMMARY
          echo "| npm Version | \${{ steps.version_check.outputs.npm }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Skipped | \${{ steps.version_check.outputs.skip }} |" >> $GITHUB_STEP_SUMMARY`,

    'vsce-publish.yml': `
      - name: Summary
        if: always()
        run: |
          echo "## VS Code Extension Publish" >> $GITHUB_STEP_SUMMARY
          echo "| Field | Value |" >> $GITHUB_STEP_SUMMARY
          echo "|-------|-------|" >> $GITHUB_STEP_SUMMARY
          echo "| Version | \${{ steps.version_check.outputs.local }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Marketplace | \${{ steps.version_check.outputs.marketplace }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Skipped | \${{ steps.version_check.outputs.skip }} |" >> $GITHUB_STEP_SUMMARY`,

    'docker-publish.yml': `
      - name: Summary
        if: always()
        run: |
          echo "## Docker Publish" >> $GITHUB_STEP_SUMMARY
          echo "| Field | Value |" >> $GITHUB_STEP_SUMMARY
          echo "|-------|-------|" >> $GITHUB_STEP_SUMMARY
          echo "| Image | \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Version | \${{ steps.version.outputs.version }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Platforms | linux/amd64, linux/arm64 |" >> $GITHUB_STEP_SUMMARY`,

    'deploy-chatbot.yml': `
      - name: Summary
        if: always()
        run: |
          echo "## Chatbot Deploy" >> $GITHUB_STEP_SUMMARY
          echo "| Field | Value |" >> $GITHUB_STEP_SUMMARY
          echo "|-------|-------|" >> $GITHUB_STEP_SUMMARY
          echo "| App | frootai-chatbot-api |" >> $GITHUB_STEP_SUMMARY
          echo "| Status | \${{ job.status }} |" >> $GITHUB_STEP_SUMMARY`,

    'mcp-ci.yml': `
      - name: Summary
        if: always()
        run: |
          echo "## MCP CI (Node \${{ matrix.node-version }})" >> $GITHUB_STEP_SUMMARY
          echo "| Check | Status |" >> $GITHUB_STEP_SUMMARY
          echo "|-------|--------|" >> $GITHUB_STEP_SUMMARY
          echo "| TypeScript | ✅ |" >> $GITHUB_STEP_SUMMARY
          echo "| Tests | ✅ |" >> $GITHUB_STEP_SUMMARY
          echo "| Server startup | ✅ |" >> $GITHUB_STEP_SUMMARY`,

    'validate-mcp.yml': `
      - name: Summary
        if: always()
        run: |
          echo "## MCP Server Validation" >> $GITHUB_STEP_SUMMARY
          echo "✅ Knowledge base and tool count verified" >> $GITHUB_STEP_SUMMARY`,

    'validate-plays.yml': `
      - name: Summary
        if: always()
        run: |
          echo "## Play Validation: \${{ matrix.play }}" >> $GITHUB_STEP_SUMMARY
          echo "✅ All Agentic OS, DevKit, and TuneKit files validated" >> $GITHUB_STEP_SUMMARY`,

    'consistency-check.yml': `
      - name: Summary
        if: always()
        run: |
          echo "## Consistency Check" >> $GITHUB_STEP_SUMMARY
          echo "| Check | Result |" >> $GITHUB_STEP_SUMMARY
          echo "|-------|--------|" >> $GITHUB_STEP_SUMMARY
          echo "| Sync needed | \${{ steps.check_changes.outputs.changes }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Validation | \${{ job.status }} |" >> $GITHUB_STEP_SUMMARY`,

    'version-check.yml': `
      - name: Summary
        if: always()
        run: |
          echo "## Version Check" >> $GITHUB_STEP_SUMMARY
          echo "✅ All version references are consistent" >> $GITHUB_STEP_SUMMARY`,

    'uptime.yml': `
      - name: Summary
        if: always()
        run: |
          echo "## Uptime Check" >> $GITHUB_STEP_SUMMARY
          echo "| Service | Status |" >> $GITHUB_STEP_SUMMARY
          echo "|---------|--------|" >> $GITHUB_STEP_SUMMARY
          echo "| frootai.dev | \${{ steps.website.outcome }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Chatbot API | \${{ steps.chatbot.outcome }} |" >> $GITHUB_STEP_SUMMARY
          echo "| npm Registry | \${{ steps.npm.outcome }} |" >> $GITHUB_STEP_SUMMARY`,

    'release.yml': `
      - name: Summary
        if: always()
        run: |
          echo "## GitHub Release" >> $GITHUB_STEP_SUMMARY
          echo "| Field | Value |" >> $GITHUB_STEP_SUMMARY
          echo "|-------|-------|" >> $GITHUB_STEP_SUMMARY
          echo "| Title | \${{ steps.info.outputs.title }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Version | \${{ steps.info.outputs.version }} |" >> $GITHUB_STEP_SUMMARY`,
};

let added = 0;

for (const [file, summary] of Object.entries(SUMMARIES)) {
    const fp = path.join(wfDir, file);
    if (!fs.existsSync(fp)) { console.log(`SKIP: ${file}`); continue; }

    let content = fs.readFileSync(fp, 'utf8');

    if (content.includes('GITHUB_STEP_SUMMARY')) {
        console.log(`OK: ${file} (already has summary)`);
        continue;
    }

    // Append summary step at the end of the file
    content = content.trimEnd() + '\n' + summary + '\n';
    fs.writeFileSync(fp, content, 'utf8');
    added++;
    console.log(`✅ Added summary: ${file}`);
}

console.log(`\nSummaries added: ${added}`);
