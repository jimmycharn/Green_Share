
import os
import re

file_path = r"g:\Web App\GreenShare\app\circles\[id]\page.js"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Labels (More flexible regex)
# Target: {isCurrent && <span ...>⭐ ...</span>} {isFuture && <span ...>🔒 ...</span>}
pattern = re.compile(r'\{isCurrent && <span style=\{\{ marginLeft: "8px", color: "var\(--primary\)", fontSize: "0\.7rem", verticalAlign: "middle" \}\}>⭐ กำลังดำเนินการ</span>\}\s+\{isFuture && <span style=\{\{ marginLeft: "8px", color: "#94a3b8", fontSize: "0\.7rem", fontWeight: "500" \}\}>🔒 รอดำเนินการ</span>\}', re.DOTALL)

replacement = """{circle.status === 'OPEN' ? (
                              <span style={{ marginLeft: "8px", color: "#94a3b8", fontSize: "0.7rem", fontWeight: "500" }}>🔒 รอดำเนินการ</span>
                            ) : (
                              <>
                                {isCurrent && <span style={{ marginLeft: "8px", color: "var(--primary)", fontSize: "0.7rem", verticalAlign: "middle" }}>⭐ กำลังดำเนินการ</span>}
                                {isFuture && <span style={{ marginLeft: "8px", color: "#94a3b8", fontSize: "0.7rem", fontWeight: "500" }}>🔒 รอดำเนินการ</span>}
                              </>
                            )}"""

if pattern.search(content):
    content = pattern.sub(replacement, content)
    print("Labels updated successfully.")
else:
    print("Labels pattern not found.")
    # Try even MORE flexible
    pattern2 = re.compile(r'\{isCurrent && <span.*?⭐ กำลังดำเนินการ.*?isFuture && <span.*?🔒 รอดำเนินการ.*?\}', re.DOTALL)
    if pattern2.search(content):
        content = pattern2.sub(replacement, content)
        print("Labels updated with flexible pattern.")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done.")
