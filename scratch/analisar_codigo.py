with open(r"c:\Users\faisc\OneDrive\Desktop\AntiGravityEDTIS\Zero1Bags\src\App.jsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

for idx in range(2039, 2150):
    if idx < len(lines):
        print(f"{idx + 1}: {lines[idx]}", end="")
