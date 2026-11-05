from PIL import Image, ImageDraw, ImageFont
import sys
PAARS=(80,18,77,255); WIT=(255,255,255,255)
FONT='/usr/share/fonts/opentype/inter/Inter-SemiBold.otf'
N=2048
def teken(schaal=1.0, achtergrond=True, hoek=0.0, mono=False):
    im=Image.new('RGBA',(N,N),(0,0,0,0)); d=ImageDraw.Draw(im)
    if achtergrond: d.rounded_rectangle([0,0,N-1,N-1], radius=int(N*hoek), fill=PAARS)
    fg = WIT
    bw=int(N*0.84*schaal); bh=int(N*0.40*schaal); x0=(N-bw)//2; y0=(N-bh)//2
    s=int(N*0.025*schaal); gap=int(N*0.026*schaal); r=int(bh*0.24)
    d.rounded_rectangle([x0,y0,x0+bw,y0+bh], radius=r, outline=fg, width=s)
    i=s+gap
    inner=[x0+i,y0+i,x0+bw-i,y0+bh-i]
    d.rounded_rectangle(inner, radius=max(1,r-i), fill=fg)
    iw=inner[2]-inner[0]; ih=inner[3]-inner[1]
    # tekst zo groot dat hij ~90% van de breedte vult (logo v2, 5 nov 2026)
    size=int(ih*0.8)
    while True:
        f=ImageFont.truetype(FONT,size); bb=d.textbbox((0,0),'Stekky',font=f)
        if bb[2]-bb[0] <= iw*0.90 and bb[3]-bb[1] <= ih*0.80: break
        size-=4
    tw=bb[2]-bb[0]; th=bb[3]-bb[1]
    tx=inner[0]+(iw-tw)/2-bb[0]; ty=inner[1]+(ih-th)/2-bb[1]
    d.text((tx,ty),'Stekky',font=f,fill=(0,0,0,0) if mono else PAARS)
    if mono:  # tekst uitsnijden (doorzichtig)
        m=Image.new('L',(N,N),0); ImageDraw.Draw(m).text((tx,ty),'Stekky',font=f,fill=255)
        im.putalpha(Image.composite(Image.new('L',(N,N),0), im.getchannel('A'), m))
    return im
def bewaar(im, pad, maat):
    im.resize((maat,maat), Image.LANCZOS).save(pad, optimize=True)
