# Stap 1: knip de losse kaarten uit de vier overzichtsplaatjes in bron/ (naar crop/).
import cv2, numpy as np, sys, os
os.makedirs('crop',exist_ok=True)
U='bron/'
sets={'r':'ruiten.jpg','k':'klaveren.jpg','s':'schoppen.jpg','h':'harten.jpg'}
for suit,f in sets.items():
    img=cv2.imread(U+f); hsv=cv2.cvtColor(img,cv2.COLOR_BGR2HSV)
    # parchment: bright-ish, low blue
    m=((img[:,:,2].astype(int)>150)&(img[:,:,2].astype(int)-img[:,:,0].astype(int)>15)).astype(np.uint8)*255
    m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,np.ones((9,9),np.uint8))
    m=cv2.morphologyEx(m,cv2.MORPH_OPEN,np.ones((5,5),np.uint8))
    n,lab,st,_=cv2.connectedComponentsWithStats(m)
    boxes=[tuple(s[:4]) for s in st[1:] if s[2]>100 and s[3]>200]
    boxes.sort(key=lambda b:(b[1]//150,b[0]))
    print(suit,len(boxes),boxes)
    for i,(x,y,w,h) in enumerate(boxes):
        cv2.imwrite(f'crop/{suit}{i:02d}.png',img[y:y+h,x:x+w])
