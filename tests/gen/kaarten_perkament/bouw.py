# Stap 2: bouw het hele spel (getallen 2-10 opnieuw getekend, foute hoeken hersteld) naar kaarten/perkament/.
import cv2, numpy as np, os
from maak import maak, sprite, plak, INFO, W, H
from blanco import laad, afstand
U='bron/'
OUT='deck'; os.makedirs(OUT,exist_ok=True)
FW,FH=375,525
def kaartbox(im):
    m=((im[:,:,2].astype(int)>110)&(im[:,:,2].astype(int)-im[:,:,0].astype(int)>10)).astype(np.uint8)
    m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,np.ones((15,15),np.uint8))
    n,l,st,_=cv2.connectedComponentsWithStats(m); i=1+np.argmax(st[1:,4]); x,y,w,h=st[i][:4]; return im[y:y+h,x:x+w]
def afronden(img):
    img=cv2.resize(img,(FW,FH),interpolation=cv2.INTER_AREA if img.shape[1]>FW else cv2.INTER_CUBIC)
    r=22; a=np.zeros((FH*4,FW*4),np.uint8)
    cv2.rectangle(a,(r*4,0),(FW*4-r*4,FH*4),255,-1); cv2.rectangle(a,(0,r*4),(FW*4,FH*4-r*4),255,-1)
    for cx,cy in [(r,r),(FW-r,r),(r,FH-r),(FW-r,FH-r)]: cv2.circle(a,(cx*4,cy*4),r*4,255,-1)
    a=cv2.resize(a,(FW,FH),interpolation=cv2.INTER_AREA)
    return np.dstack([img,a])
APP='../../../kaarten/perkament'; os.makedirs(APP,exist_ok=True)
APPNAAM={'J':'B','Q':'V','K':'H'}   # in de app: boer, vrouw, heer
def bewaar(naam,img):
    rgba=afronden(img); cv2.imwrite(f'{OUT}/{naam}.png',rgba)
    if naam[1:] in APPNAAM: naam=naam[0]+APPNAAM[naam[1:]]
    cv2.imwrite(f'{APP}/{naam}.webp',rgba,[cv2.IMWRITE_WEBP_QUALITY,84])
# naam in de app: h=harten r=ruiten k=klaveren s=schoppen; B V H A = boer vrouw heer aas
FACE={'h':{'J':'h08','Q':'h09','K':'h10','A':'h00'},'k':{'A':'k00','J':'k04','Q':'k05','K':'k06'},
      'r':{'J':'r04','Q':'r05','K':'r06','A':'r07'},'s':{'J':'s07','Q':'s08','K':'s09','A':'s10'}}
FOUT=[('h','K'),('k','K'),('s','Q'),('s','K')]
def herstel_hoek(img,suit):
    lab=cv2.cvtColor(img,cv2.COLOR_BGR2LAB).astype(float)
    d=np.linalg.norm(lab-np.array([224,130,148]),axis=2)
    zone=np.zeros(d.shape,bool); zone[425:540,300:396]=True
    # het verkeerde teken: donker/gekleurd ten opzichte van perkament, grootste vlek in de hoek
    m=((d>50)&zone).astype(np.uint8)
    n,l,st,c=cv2.connectedComponentsWithStats(m)
    kand=[(st[i][4],i) for i in range(1,n) if 25<st[i][2]<75 and 25<st[i][3]<80]
    _,i=max(kand); x,y,w,h=st[i][:4]
    gat=np.zeros(d.shape,np.uint8); gat[y-4:y+h+4,x-4:x+w+4]=1; keep=(1-gat).astype(float)
    f=img.astype(float); num=cv2.GaussianBlur(f*keep[...,None],(0,0),8); den=cv2.GaussianBlur(keep,(0,0),8)[...,None]
    f=np.where(gat[...,None]>0,num/np.maximum(den,1e-3),f)
    bron=laad({'h':'crop/h01.png','r':'crop/r00.png','s':'crop/s00.png','k':'crop/k07.png'}[suit]); bd=afstand(bron)
    k_rgb,k_a=sprite(bron,bd,INFO[suit]['klein'],3)
    plak(f,k_rgb,k_a,x+w/2,y+h/2,(h+2)/INFO[suit]['klein'][3],draai=True)
    return np.clip(f,0,255).astype(np.uint8),(x,y,w,h)
FOUT_BOX={}
def spiegel_hoek(img,extra):
    # rechtsonder = linksboven, 180 graden gedraaid (daar staat het goede teken)
    rot=img[::-1,::-1].astype(float); f=img.astype(float)
    m=np.zeros(img.shape[:2],float)
    for x0,y0,x1,y1 in [(318,425,400,590)]+extra: m[y0:y1,x0:x1]=1
    m=cv2.GaussianBlur(m,(0,0),4)[...,None]
    return np.clip(f*(1-m)+rot*m,0,255).astype(np.uint8)
for suit in 'hrks':
    for n,img in maak(suit).items(): bewaar(f'{suit}{n}',img)
    for r,f in FACE[suit].items():
        img=laad(f'crop/{f}.png')
        if (suit,r) in FOUT: img=spiegel_hoek(img,FOUT_BOX.get((suit,r),[]))
        if (suit,r)==('s','Q'):
            # groot klaveren-teken onderin de tekening -> gedraaid schoppen-teken van bovenin
            lab=cv2.cvtColor(img,cv2.COLOR_BGR2LAB).astype(float)
            p=img[90-48:90+48,101-44:101+44][::-1,::-1].astype(float)
            m=np.zeros(p.shape[:2]); m[10:-10,10:-10]=1; m=cv2.GaussianBlur(m,(0,0),5)[...,None]
            cy,cx=483,272; reg=img[cy-48:cy+48,cx-44:cx+44].astype(float)
            img[cy-48:cy+48,cx-44:cx+44]=np.clip(reg*(1-m)+p*m,0,255).astype(np.uint8)
        bewaar(f'{suit}{r}',img)
bewaar('achterkant',kaartbox(cv2.imread(U+'achterkant.jpg')))
bewaar('joker',kaartbox(cv2.imread(U+'joker.jpg')))
# overzicht
volg=['2','3','4','5','6','7','8','9','10','J','Q','K','A']
bg=np.full((FH,FW,3),(60,20,30),np.uint8)
def tegel(naam):
    x=cv2.imread(f'{OUT}/{naam}.png',cv2.IMREAD_UNCHANGED); a=x[:,:,3:]/255
    t=(x[:,:,:3]*a+bg*(1-a)).astype(np.uint8); return cv2.resize(t,(150,210),interpolation=cv2.INTER_AREA)
rijen=[np.hstack([tegel(f'{s}{v}') for v in volg]) for s in 'hkrs']
extra=np.hstack([tegel('achterkant'),tegel('joker')]+[np.full((210,150,3),(60,20,30),np.uint8)]*11)
cv2.imwrite('overzicht.png',np.vstack(rijen+[extra]))
