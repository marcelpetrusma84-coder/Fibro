import cv2, numpy as np
from PIL import Image, ImageDraw, ImageFont
from blanco import blanco, W, H, laad, afstand
# grote teken (bbox in 400x590), klein teken, rangcijfer (hoogte/positie)
INFO={'h':dict(groot=(156,76,89,91),klein=(18,97,49,49)),
      'r':dict(groot=(158,75,81,98),klein=(17,92,44,57)),
      's':dict(groot=(157,70,85,109),klein=(14,99,46,57)),
      'k':dict(groot=(72,79,91,91),klein=(15,93,52,52))}
def sprite(im,d,box,pad=4):
    x,y,w,h=box; x-=pad;y-=pad;w+=2*pad;h+=2*pad
    rgb=im[y:y+h,x:x+w].astype(float)
    a=np.clip((d[y:y+h,x:x+w]-32)/22,0,1)
    a=cv2.GaussianBlur(a,(0,0),0.6)
    return rgb,a
def plak(dst,rgb,a,cx,cy,schaal=1.0,draai=False):
    if schaal!=1.0:
        rgb=cv2.resize(rgb,None,fx=schaal,fy=schaal,interpolation=cv2.INTER_AREA); a=cv2.resize(a,None,fx=schaal,fy=schaal,interpolation=cv2.INTER_AREA)
    if draai: rgb=rgb[::-1,::-1]; a=a[::-1,::-1]
    h,w=a.shape; x=int(round(cx-w/2)); y=int(round(cy-h/2))
    reg=dst[y:y+h,x:x+w]; reg[:]=reg*(1-a[...,None])+rgb*a[...,None]
LX,MX,RX=.30,.5,.70
LAYOUT={2:[(MX,.2),(MX,.8)],3:[(MX,.2),(MX,.5),(MX,.8)],
 4:[(LX,.2),(RX,.2),(LX,.8),(RX,.8)],5:[(LX,.2),(RX,.2),(MX,.5),(LX,.8),(RX,.8)],
 6:[(LX,.2),(RX,.2),(LX,.5),(RX,.5),(LX,.8),(RX,.8)],
 7:[(LX,.2),(RX,.2),(MX,.35),(LX,.5),(RX,.5),(LX,.8),(RX,.8)],
 8:[(LX,.2),(RX,.2),(MX,.35),(LX,.5),(RX,.5),(MX,.65),(LX,.8),(RX,.8)],
 9:[(LX,.2),(RX,.2),(LX,.4),(RX,.4),(MX,.5),(LX,.6),(RX,.6),(LX,.8),(RX,.8)],
 10:[(LX,.2),(RX,.2),(MX,.3),(LX,.4),(RX,.4),(LX,.6),(RX,.6),(MX,.7),(LX,.8),(RX,.8)]}
SCHAAL={2:.9,3:.9,4:.85,5:.85,6:.8,7:.72,8:.72,9:.68,10:.66}
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
FONTC='/usr/share/fonts/truetype/dejavu/DejaVuSerifCondensed-Bold.ttf'
def kleur(im,d,box):
    x,y,w,h=box; reg=im[y:y+h,x:x+w].reshape(-1,3); dd=d[y:y+h,x:x+w].reshape(-1)
    return np.median(reg[dd>np.percentile(dd,80)],0)
def rang_laag(tekst,col,cx,top,hoogte):
    lay=Image.new('L',(W,H),0); dr=ImageDraw.Draw(lay)
    f=ImageFont.truetype(FONTC if len(tekst)>1 else FONT, int(hoogte*1.32))
    if len(tekst)>1:
        f=ImageFont.truetype(FONTC,int(hoogte*1.32))
    bb=dr.textbbox((0,0),tekst,font=f); tw=bb[2]-bb[0]
    if len(tekst)>1: f=ImageFont.truetype(FONTC,int(hoogte*1.32)); 
    dr.text((cx-tw/2-bb[0],top-bb[1]),tekst,font=f,fill=255)
    a=np.asarray(lay).astype(float)/255
    if len(tekst)>1 and tw>58:  # smal maken
        pass
    return a
def maak(suit):
    leeg,orig,d=blanco(suit); info=INFO[suit]
    g_rgb,g_a=sprite(orig,d,info['groot']); k_rgb,k_a=sprite(orig,d,info['klein'],3)
    col=kleur(orig,d,info['groot'])
    kx=info['klein'][0]+info['klein'][2]/2; ky=info['klein'][1]+info['klein'][3]/2
    uit={}
    for n in range(2,11):
        c=leeg.astype(float).copy()
        sc=SCHAAL[n]*(80/max(info['groot'][2],info['groot'][3]-15))
        for fx,fy in LAYOUT[n]:
            plak(c,g_rgb,g_a,fx*W,0.09*H+fy*0.82*H,sc,draai=fy>.5)
        # hoeken
        ks=40/info['klein'][2]
        plak(c,k_rgb,k_a,kx+4,ky+8,ks); plak(c,k_rgb,k_a,W-kx-4,H-ky-8,ks,draai=True)
        t=str(n); a=rang_laag(t,col,kx+4,30,44 if n<10 else 40)
        if n==10: a=cv2.resize(a,None,fx=1,fy=1)
        a2=a[::-1,::-1]
        for aa in (a,a2):
            c=c*(1-aa[...,None])+col*aa[...,None]
        uit[n]=np.clip(c,0,255).astype(np.uint8)
    return uit
if __name__=='__main__':
    import os; os.makedirs('uit',exist_ok=True)
    rij=[]
    for s in 'hrsk':
        u=maak(s)
        for n,img in u.items(): cv2.imwrite(f'uit/{s}{n}.png',img)
        rij.append(np.hstack([cv2.resize(u[n],(200,295)) for n in range(2,11)]))
    cv2.imwrite('getallen.png',np.vstack(rij))
