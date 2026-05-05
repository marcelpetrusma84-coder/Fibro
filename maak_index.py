lines = []
lines.append("<!DOCTYPE html>")
lines.append("<html lang=nl>")
f = open("/home/deck/fibro-web/index.html", "w")
f.write("\n".join(lines))
f.close()
print("Klaar")
