# Het Stekky-logo (5 nov 2026; v3: vier widgetblokken): python3 tests/gen/logo_bouw.py tests/gen .  -> icon-192/512, icon-maskable-512, apple-touch-icon, icon.svg en de Android-iconen
import sys; sys.path.insert(0, sys.argv[1]); from logo_teken import *
R=sys.argv[2]; A=R+'/android/app/src/main/res/'
gewoon=teken(1.0, True, 0.22)       # "any": afgeronde hoeken
vol=teken(1.0, True, 0.0)           # iPhone (rondt zelf af)
mask=teken(0.84, True, 0.0)         # maskable: alles binnen de veilige cirkel
mono=teken(1.15, False, 0, True)    # meldingsicoon Android: wit, doorzichtig
bewaar(gewoon, R+'/icon-192.png', 192); bewaar(gewoon, R+'/icon-512.png', 512)
bewaar(mask, R+'/icon-maskable-512.png', 512)
bewaar(vol, R+'/apple-touch-icon.png', 180)
open(R+'/icon.svg','w').write('''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="113" fill="#50124d"/>
  <g fill="#fff">
    <rect x="75" y="75" width="171" height="171" rx="32" fill="none" stroke="#fff" stroke-width="11"/>
    <rect x="98" y="98" width="125" height="125" rx="14"/>
    <text x="160.5" y="191" font-size="106" text-anchor="middle" font-family="Inter, 'DM Sans', Arial, sans-serif" font-weight="700" fill="#50124d">S</text>
    <rect x="266" y="75" width="171" height="171" rx="32"/>
    <rect x="75" y="266" width="171" height="171" rx="32"/>
    <rect x="271.5" y="271.5" width="160" height="160" rx="27" fill="none" stroke="#fff" stroke-width="11"/>
  </g>
</svg>
''')
for d,m in [('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)]:
    bewaar(gewoon, A+'mipmap-'+d+'/ic_launcher.png', m)
for d,m in [('mdpi',82),('hdpi',123),('xhdpi',164),('xxhdpi',246),('xxxhdpi',328)]:
    bewaar(mask, A+'mipmap-'+d+'/ic_maskable.png', m)
for d,m in [('mdpi',24),('hdpi',36),('xhdpi',48),('xxhdpi',72),('xxxhdpi',96)]:
    bewaar(mono, A+'drawable-'+d+'/ic_notification_icon.png', m)
for d,m in [('mdpi',300),('hdpi',450),('xhdpi',600),('xxhdpi',900),('xxxhdpi',1200)]:
    bewaar(gewoon, A+'drawable-'+d+'/splash.png', m)
