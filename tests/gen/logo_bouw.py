# Het Stekky-logo (5 nov 2026): python3 tests/gen/logo_bouw.py tests/gen .  -> icon-192/512, icon-maskable-512, apple-touch-icon, icon.svg en de Android-iconen
import sys; sys.path.insert(0, sys.argv[1]); from logo_teken import *
R=sys.argv[2]; A=R+'/android/app/src/main/res/'
gewoon=teken(1.0, True, 0.12)       # "any": iets afgeronde hoeken (logo v2)
vol=teken(1.0, True, 0.0)           # iPhone (rondt zelf af)
mask=teken(0.84, True, 0.0)         # maskable: alles binnen de veilige cirkel
mono=teken(0.92, False, 0, True)    # meldingsicoon Android: wit, doorzichtig
bewaar(gewoon, R+'/icon-192.png', 192); bewaar(gewoon, R+'/icon-512.png', 512)
bewaar(mask, R+'/icon-maskable-512.png', 512)
bewaar(vol, R+'/apple-touch-icon.png', 180)
open(R+'/icon.svg','w').write('''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="61" fill="#50124d"/>
  <rect x="47.4" y="160" width="417.2" height="192" rx="43" fill="none" stroke="#fff" stroke-width="12.8"/>
  <rect x="67" y="179.5" width="378" height="153" rx="24" fill="#fff"/>
  <text x="257" y="288" font-size="106" textLength="330" lengthAdjust="spacingAndGlyphs" text-anchor="middle" font-family="Inter, 'DM Sans', Arial, sans-serif" font-weight="600" fill="#50124d">Stekky</text>
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
