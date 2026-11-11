import cv2, numpy as np
W,H=400,590
SRC={'h':'crop/h01.png','r':'crop/r00.png','s':'crop/s00.png','k':'crop/k07.png'}
def laad(f): return cv2.resize(cv2.imread(f),(W,H),interpolation=cv2.INTER_CUBIC)
def afstand(im):
    lab=cv2.cvtColor(im,cv2.COLOR_BGR2LAB).astype(float)
    parch=np.median(lab[int(.4*H):int(.6*H),int(.4*W):int(.6*W)].reshape(-1,3),0)
    return np.linalg.norm(lab-parch,axis=2)
def blanco(suit):
    im=laad(SRC[suit])
    if suit=='k':
        b=laad('crop/k02.png'); im=im.copy(); im[538:580,70:340]=b[538:580,70:340]
    d=afstand(im)
    zone=np.zeros((H,W),np.uint8)
    zone[60:535,68:332]=1           # middengebied (grote tekens)
    zone[14:160,12:72]=1            # hoek linksboven
    zone[430:578,328:390]=1         # hoek rechtsonder
    m=((d>28)&(zone>0)).astype(np.uint8)
    m=cv2.dilate(m,np.ones((13,13),np.uint8))
    keep=(1-m).astype(float)
    f=im.astype(float)
    sig=18
    num=cv2.GaussianBlur(f*keep[...,None],(0,0),sig); den=cv2.GaussianBlur(keep,(0,0),sig)[...,None]
    glad=num/np.maximum(den,1e-3)
    # korrel: fijne structuur uit een schoon stuk
    schoon=f[250:340,150:250]
    hp=schoon-cv2.GaussianBlur(schoon,(0,0),4)
    korrel=np.tile(hp,(H//90+1,W//100+1,1))[:H,:W]
    vul=glad+korrel
    zacht=cv2.GaussianBlur(m.astype(float),(0,0),2)[...,None]
    out=f*(1-zacht)+vul*zacht
    return np.clip(out,0,255).astype(np.uint8), im, d
if __name__=='__main__':
    for s in SRC:
        b,_,_=blanco(s); cv2.imwrite(f'blanco_{s}.png',b)
    ims=[cv2.imread(f'blanco_{s}.png') for s in SRC]
    cv2.imwrite('blanco_all.png',np.hstack(ims))
