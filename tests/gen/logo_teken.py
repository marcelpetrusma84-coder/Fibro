# Het Stekky-logo v3 (5 nov 2026): vier widgetblokken in een raster, linksboven met een S (keuze van Marcel).
# Linksboven: wit kader met een wit blok en een paarse S. Rechtsboven en linksonder: wit blok. Rechtsonder: alleen een wit kader.
from PIL import Image, ImageDraw, ImageFont
PAARS=(80,18,77,255); WIT=(255,255,255,255); LEEG=(0,0,0,0)
FONT='/usr/share/fonts/opentype/inter/Inter-Bold.otf'
N=2048
def _s(d, box, kleur):
    x0,y0,x1,y1=box; w=x1-x0; h=y1-y0; size=int(h)
    while True:
        f=ImageFont.truetype(FONT,size); bb=d.textbbox((0,0),'S',font=f)
        if bb[3]-bb[1]<=h*0.62 and bb[2]-bb[0]<=w*0.62: break
        size-=4
    d.text((x0+(w-(bb[2]-bb[0]))/2-bb[0], y0+(h-(bb[3]-bb[1]))/2-bb[1]), 'S', font=f, fill=kleur)
def teken(schaal=1.0, achtergrond=True, hoek=0.0, mono=False):
    im=Image.new('RGBA',(N,N),LEEG); d=ImageDraw.Draw(im)
    if achtergrond: d.rounded_rectangle([0,0,N-1,N-1], radius=int(N*hoek), fill=PAARS)
    blok=N*0.334*schaal; tus=N*0.039*schaal; r=int(N*0.0625*schaal); dik=max(1,int(N*0.0215*schaal))
    a=(N-(2*blok+tus))/2; b=a+blok; c=b+tus; e=c+blok
    gat = LEEG if mono else PAARS   # wat in het logo paars is: bij het meldingsicoon doorzichtig
    # linksboven: kader + blok + S
    d.rounded_rectangle([a,a,b,b], radius=r, outline=WIT, width=dik)
    i=dik+int(dik*1.1)
    d.rounded_rectangle([a+dik,a+dik,b-dik,b-dik], radius=max(1,r-dik), fill=gat)
    d.rounded_rectangle([a+i,a+i,b-i,b-i], radius=max(1,r-i), fill=WIT)
    _s(d,[a,a,b,b],gat)
    # rechtsboven en linksonder: vol blok
    d.rounded_rectangle([c,a,e,b], radius=r, fill=WIT)
    d.rounded_rectangle([a,c,b,e], radius=r, fill=WIT)
    # rechtsonder: alleen een kader
    d.rounded_rectangle([c,c,e,e], radius=r, outline=WIT, width=dik)
    return im
def bewaar(im, pad, maat):
    im.resize((maat,maat), Image.LANCZOS).save(pad, optimize=True)
