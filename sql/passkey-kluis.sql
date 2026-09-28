#!/usr/bin/env python3
# maak-passkeykluis.py - zet passkey-kluis.js en kluis-test.html in ~/Fibro (nieuwe bestanden)
# Blok: JSON -> zlib -> base64, regels van 60 tekens met crc32-controle.
import base64, binascii, hashlib, json, os, sys, zlib

MAP = os.path.expanduser('~/Fibro')
VERWACHT = {
    'passkey-kluis.js': '1dd0e1bcf6e93fb1d93751031ec1d6c2',
    'kluis-test.html': '991f3d3fd9b7aafb81a0f96163437526'
}

BLOK = """
eNrNPAt72zaSfwV2b5fkRaIfidOcEiefYzttmjTJxm57t3a+fBAJSbAokktS c456
ku3U//1mBg+CFCW73b1H+7WSQGAwmPcMhv62nfOynIqb/jSZyzK8KrcHbHtn d2ca
h7WHWZ/FMppUgsVZVg5YLNhYTIScCVYmYl6JhC1Eob/GbCYqJkRqwai5zP9N 7226
DI/m1SRlnz6/CS5T2OgEAIgC1rKhWHJeVIwnCS6N1VbMr/gQoGtIXwmhIGQf fe59
c5HCrClPzQLcExbpiQTcf8Mjwd6e9NhCpmNR8FFczKcsG7EqEyVgmss0ymIB 363a
8H4Qt3g+BoAacwGzhFcwOgHwehVLs0xWIW1xBJuz0TyNKilKNi3k1VghfzbP 141e
+ZCXoh8lUqQVoCeYXw6DHrvNYg4bJVNEdixTzm7lVcqExJV6Np5rLIbFXE5F b41e
CjtdAp5pWbHzo9en79kh8xr08Mzjtx/efISnqViyc3FdndLpCj8IBX3zvZEc 712c
Flm/wd3+Yt8LDIDfjo5/PD9/+9MJQNnb34V/cG91vixlo2xe+QipxyoxLauA 1fb8
fbtMGVNrhd75tCiywlfP8akIcQU8xA8cKEQ1L+DAl+ldA/rw6ZN5kfjD+agB ab04
d6jh/iLT6tlRUfAbmvKcJcCSEonh4eRRVjAfhyQM7T6HjxdsGCYiHVcT+PXo 4e88
UQCTHx2ys6oABoejIpsdT3hxjHQZXsgvgYPasMq4D2JWiDwBEfJ3Li8f7Yx7 8875
zOt7jcEdGvzqDh4++rcdGEOS3jlnW/D0tTqeIVrFDC4wVK/vE8hHLsivNLTj 4a46
wZGXEwny5lf6XOwv7EkAkOBY3qFXkwypwqtsCJB7XfQr9fpgHeHKJuGQPvCw 9976
DCNNsaPKlw2CdZ3Wb8qHRao+NXyZ+cH/DY5LCao7FfNCjv0UEDXTouImr7Jw 75ef
LKrPPI2z2a88mYvSb2GXBgFrSm9ejH6RoB2FiJtqcY2cxmH217/SJ8I+Jj0/ 3bdb
vQbTUsLqz6KcJ1XJXt0zwQ/YgH27q6GPZFEifNwFwMNHCIg4X0GMFOjVoZAW ef30
OxRSwF61OUHDuHE6TxKttLy8SSNmD89FeaaMv69sPZq5eZP/YA0lycCSy8qQ db71
uZwPq0SEcpZnRfVO3PhewZdejxko3o/vTt7A7xFPSrA6Fx7YM7kQMNNraGwT c3a8
nJ3k4xQGzE35TAwstAkvJ/Dr7Mej/v7BUxgoeVINCOUek+koGyhTetdT6wn1 91fa
Xg3m6PSs/8Pxz7BQieCAARiYXaMJBhcxghmAsfr6JWgbPPBb5esE1dQxplVx 67bc
o7649u+ns48fwpwXpXAMK2NyxPwhcnYYLtjh4SHbVz9u1YdcqM8IYNdKwNgd fbd6
i3gVTZgvAi1M+qnDYPBt/X6f/caVM4qldX+v8MFlKq6RZawlCNq1nFW8mqO0 80be
tvT/m5kAMYSmFXrbYTZfxnYERFTJGiPc8JBbSwm6uAw/zYeJjICxx6AmoB+S 5d71
J+z339lWyhdyDMalCCP7oLSHLhFMGZqtAY+qmAtLbHhkkYBnW1u+EtGOzUJZ 8d9a
/gLxyq8gX6MbWPQJggOwTTOManBGhDgcLbhM+DARPhqJFVo7DMajde1i9f+Y 49a8
QxQhE4nRRWBWGYJGVpkeDMMPDAjcOkLx8ISxMQMgvAf8YFGA1AIzgsSILloz 4709
vigQdxslqazF6B2IiQDN4TO2yMCOO6JkgqErgdtCkJDIKzjYrQRLv6QIiWJA c7bc
DAzBIsw4n4IHKK3sWanT4D7AHk2Zm3N0LFY45sC7ozEGWCA0KmxAp4IG1DtX df0b
MDwjcjvy0yRLxU5Ywbg/50Gg5qlhmiZAXM1cHnfM5HFr3lEaF5lcnarHW7N/ 256c
I6EvV2br8X4etRb8zCP28Yz958oKeNCa+l6m8+uVeTQKcBlG5tHUUmhowyxa 7295
fFzIj2e/H08ghhIYBVkwKFBbO6fx2IVMi9XkFhJvrhHOG1mIUXbdAKRX6Uet 4edd
ZV3wYawN/YyPeCG7wKonniOvYEZfYSDFPOZ78DHEr4EHTg/ClBKUS/i7PfZ0 9b09
N2iax5PsVlC4Q1LNoyibg3BtsI8k4LQKkoEeQ4F824wXvjHQCN5jAsNoUDCj 16e7
4+WQYlafUgCtxmEpEhFVvodW76uMe6RmPaMrX7McQitwMJ6ZL/7he7gnzPXs 8731
7vpZVmCu4NVrPfR4vIxEGoOpG5DRZHeBkQJCEOQGGLtUmYGX5RMOHhG9nqKM f012
HmAzWSbzKbhYpC0tDGeiLPlYuE7cx5Ojal58CSA4SSrAp2CHL2tHWYR4nMBw 2a2c
oZvGkLMt5RUc5gSMh0PmHgVXK+TeTGiIJUABBOZQXbSjUU19z26wgURLMR5D 8ae3
+qiI9Jv5sZlATYkDgzjjkBaCj5RivrQpLyxs5+TgptJN0oictkT6ZslkMs+i dda7
VOKUQzQFSTD4F4jqQQIU/cgvGwF2jwhoVX30qEk2RqJ4H9Ce2wFLna0G3CaM ae61
MaT0fX0MBPEDpvjmWFnuOhEFUMdKMMIhbLfM7Na3egGGfDDZTQYe7zvPyW3Z a6ff
RK1JGHIibzCj9to2QllNlIZ2SId5gEGuM2rB70AUH0Il49UHtecv8kEdhqq9 f467
bZTK6Hj4XEIwtbYIoGnQ01AUi2NZQrZ588EBzPokjHTSegvIrhIMemFai2h2 cb00
CuCtQ5FPvOAzCPUuvrHqJkfI6kx9EFfgKk/AqvS/x8B504T9A5jyxYLnbqx1 2b0f
RgYQQxPK4EqJZCSSeYX4xxzcB0qg/vrZfY7WTAkERXMIjsDU65xTi+somcei 6044
Dq/gUEbWwhnPlZnyu0+B3Kjzf8VsMBcQGwY10SrQW5DFQV2CcTbX4VeJh6To 13e9
GKzWgif4ScmZSl3Aht2psAwDM2WoGwFaHXQKSgdDlADKG7y3KcCTMcbtggo4 dab8
XlMf1WGrPidt/NXEccbj6cdsIkUBXKPi3xu31uQFGzb/kFVHSZItRdy19Vjw 1e86
FLIBIYpYWQL7Eyt5aGzQEowVN8w+CgDF+E62rMwz6J8uNVGyDQmnNgmos7pU c3eb
edjI563FUk+DZoJWZ/j/msxeU2ltRi9STC5ioh2lTB2mEwN19MLitvYPqqgo 0a3c
UnPGsVjADx9rsYZs4GTOstlMjgUD5i1BOUo9bVLTBuCxobyiIe3g1Wqin6Z/ 1db5
bfIYG99j8YAoa8zdg+wNwxJwtmwo58V6VWxVNxwZcK0M22ganGkbFPfPqW6t e5eb
vJ3q+7+nQw0tYga9toKMHc22+rFRHrVk4c4PFk1HieWi5bD3XIcdVWtKTLoi f296
43cUcQAiuCC1aF0lSzN1rVdtxjJuSAIBq6nglBRGyNENYLEYsH2APTC2SO0C bf79
uNgRuYDfUWV/YxnnLnh46Krj+nkOxMZz6+B10AiHaUDZRZUrqBxi0MqpyUVn 02e6
6XGWjkCbME7V0Hom+L0vMygTFC3KDCCC1b8fmBh8M5b7riMYzugqaMCmeAPj 0fc2
3Dq107Keup7puruCRGM+3hQo4x6tbOJfEQUrPsaUKt0fsdJWNNmUxlf1DOsl 3268
uNlpwWTJ0mys1EpfhPUnYNDpsq7lwF10clEcqyjVLTTX5gEeXHyxRXn1lJSZ 68dd
UAtWi5ft7E0919tc2HjoC9UHtVGs46VheBsY21MjEebzcvLH4y1rSv58eL7e 1378
WT3AVa06qvpIjSj+XsfzZ+LF1059cGD5/Kdjxv8vYZsWQYhIDpUMhiOZxiok 1d2a
t9wnlFvp+RasaZmpdAhsS+OV2GmSoVUgrDH0WaM6DwseH+Qcx3zU8IjKRDke 0554
sUu/5FWtYSjhkNJVLQnHoTUeUl9UdHvIpkqCa3Kyo7Wes6nFQXMA3Nk6cXMp 4469
NOV5VinyqGrwFOwxMWKJFSskEFrn2IkTrNdoOOU6JT4RxnnHQjlvIErQs25Q 8d60
OUCkpkp+m04HfGBVZAkQSAlFjGxrexQSEkF+Y8iLelyqSDovspG85ypFL/nE 611f
y+q1vGoGGL3aAFHp5Ft3TYXuRpozzVUf5g1WTGANQayvRHAIxERf5DaDm+c4 15cf
1XnYgN/gZmM3xRvHaUTzYiHQGFx4n/Q9HHx5/OyJ+nKwv+d9qUXCTSjU+un9 ba64
l4n5NCqfeT19QivYp8cnP3qqABIfIxYDjQyEOaou4F400h0e/ngtq1JfO9ZY 2110
5PdjUeZT6RGB/xgO7a2u1p1YCRDtdbWcAtRpe2X+0JW5Xal5t7V1NQ2v0fbT 07cb
J5rRq9wO3JiBm46E5a6tkVrqYGi7x7ZV+wmW5sNJNUuw9ejF1snH4/P/+nTK a88a
cOTlZfoCP1nC0/Hh5XaaXG7TmOAxfs5ExdHrFqWo4PEv52/6z9QMeoKkheGF 26d3
FEs85OU2EgNcI85dyriaHMZiISPRpx94EynRM/bLCFLawz3sGlIr+yNZHUbZ 62d2
QhQKeiWBdC9NkawdW/l4ouDFjpoF08vqhr4MiizDqL3fH44H3+3xXb4vnsOv f48d
iBfxoBgPub9/cNAz/+2Gu08DfDykwnzXBEh8cAI4IjjU4Lto99mTUVSP7A++ f8b3
G+3yoRqqwO7B78fi2WiEv2dgW8yuTx739h/va6C4KTDo3wHRYXbdL+UtFv8V 322c
EoDLNT0dZjFaiSGPpuMCvGA8WPDCx4PB6ihLskIP4LYwNALC90d8JpObQcnT 7a91
sl9ifPOczfi1ov7g4Olufo0DxVimg12s8mVgaHhMdw97T/Gh/tWvsnwAPIp8 157b
HMa8IV34JR+JPlhaDjE3iAPO6TEAGajjTPYwtkQs4EBisO9u9gSA7NIs1ApM 3adc
NpwDEJ3MCWjt3mNcm8hUAMvleFIN9sIDAwwoVFXZbLD3JFeUQoc87SIVch3g cebf
au7uhgeARZklEKloUtIDO6Nf8FjOy8HevkMJ/au19X5j68l+4+R7Bw0y77Kn 191b
jdl5czIdtYscDoC93U56oJTMASH0w4rFe7u7f2mjro+fZqlYOSnBbWNOv5dq bef0
n6e7wDYwmiWgl2cSdLsw2Fr1cuiOKPKiP0b4oB7+3uODWIx76mBKZYLGr/3A eb6e
npRkzpBKnSscQ4RQNlnbpaTdGnE/392TPtnddXeeJkLWdG2qCqqEom2bj4Zn 117b
DqRBLEtVTITsPueRrG4ApSeKfSF2wnTIQ5PVz5y5beUxZOxgG66hcO6buXsY 29b0
jBIB0Hkix2lfVmJWDnA18nTMcy0O5pTPlM5qiUHm3EdJ5wBm7wElm/1oIpOY 6a60
zJ0FpuTR4hhS0w2SAlAc7LVJ8GR1apnz9H5LYjT1uwQS9W8NKznL0gyARGJ1 a2be
wXIC1OnTw0FegPsqeP6couH+EAzgdED/7+PA8xXh3O3Rv+Hjg6Bb4ax+ahN5 c9f3
bc75eJdG0A2OIOvTYocHH2ckQFrznvBYPEMOsxAj+PrB6Nn3e9/v0QOMOuvx 92d6
4XC0r2kIwAEp7ISt5cIy48WOcaUvdkwMgJ6IYoK9l+scMTyCCTEEtFEC6Rx4 6cc7
fzDz4MnP4bHuwMXm4Suhe3DVxYVO70L2M7WdUE9y3QJtVrhXkqaVGW/ThGlL 94a3
xgxgjFcjeoFOKEP2k7A3SM6FbQqDBW2TmvyGch2Yhk3JgEn4YgeO8hITksaZ 1c2e
0HxTeMLYi8n+y5P6ghQosK/G3fmosBASyRjpQe1asPq1uJVjQjUBLqZhaHd7 2721
2K4/CZWBN7ekPWgcpnYg8fJ9Y7M/tuVe6NyJ1/vmL9/VveHAHfww/dvUT+Qw fba6
jyeMrq+IKTAgRpm+HG+0sbPLbRINoBo2fQA3xpWJ/jCNAYhu7zicJle4aD9I cf34
ZJimWY4SBUCM7X1Z40+k1yBf7Kh1D6bEfugWRF1SYLe8FmFHds2xsO1c57QC 7037
0lCs5LVaCKZJllfYdN8g420GolvYmdN5ilAnYsZiIDBoVfOent2KCsSawGCj c4aa
frSDLUZm2ZVDedv5DvTkOPdvn/uYp6+nKB5whaKKDmtI2gHk74JyBE1ca4mA 503e
wmedjQf6QH+YT7/imxJ83KEj4AZQQzSUGkUDiCIOo7SI8rssl4LSEg2UTXGk 3586
WIdVGRUyr6hqChBmWTxPBGGmslXshdTvLYCVxqsE5oU7Zii8Kl8tDv/jwHOm 0b2a
TzhPPtnqwEeIuQELd8CBozPPDiiNrtGeUwLv2RaVnq3B95oNPr1WoaTn3lw4 5258
u7dfaQEk9rz6zQog/WlCBcRoPgNtwTrvaSLw6+ubt7HvwQQsMdWdXNlY9eIC f938
AlgHanQVFS4k1dChgfkeMKPugdFLi5BY/IFqqwoepc0hRovHKmvFtlXcj6o2 afb7
iG3Icyx8HWP44hdBPQ5czpLkPMOk3x35kRx5sw0eXfQ5gm0UbEyxl97ceMW8 231d
C7qeUT8fMe8Lw844zwvgh2/mmnsbLDrpfhlhuuTR36ubDOzHnCdJz3TWeJ6u 0da5
ZYmpfQTqAmLV+vkObRA7NE3CuuqnJ3W0pCecx11tyKq/DkviJSCMM+/cGzQj f154
69hlgjJwpib5Ts1VbJQT5UudLie9ja1kiaTF1ebNUMjeQzAoMIbBaiEWElWl 29fb
oWV8fOqYrSvGAdPRhhrVgU2WU5NY6OkbehDa1nZY3kIhMCX4doGQ6jeWd/ow 36e4
1EkbyniVrFjZ7KIn3Ut6VPdMRIkNU7p1ESFhpcaUNL9Stwj11TUa7UrAGFuq dfa7
cUstOz5tBsKHn6EBFDh9WTi5lq7m/Ho7WqHEiNXC1zZtvnMV1xRJveSVOXOz eb2b
cKueWinHPg9LXOfNGFraap93DIoAduG8C8WlC+9IXz8oTTKNCxe2j7nXvMGt 8026
J3Q7M69XH8N3jwfaf8V7KgSwkYMqX5MRwIczDKgA94p9eHt6TjLrzMITe6kQ db64
Xo3DJ92Kj69e1H35tJW3OtvEWDvNd/Ow2YgA1N37DQjM9Os1ggsMKf72OXCR e944
+fyGLbIEXH1plEnhhR3wh8rAIGR7OQTwffW4iXFA16JfVBdyW8l1tzGyEfKi 50db
4pRHE9+/mII3+xLgTVXj2jR+iP9gLNYuwJ+iVQYsgvbd6zogQ3ybbNjCcfG8 9845
hmiuaYVxM76S/DvjZ3wjgXWXIHZP/04/m80DatzEicg2dd/vb5A45pPEBVrG 9b49
QHdRvDAX2gpqiQpqbD7ZF0sI9FqxMug4753oBWvEyK4AOamBb5ANeqowW+sl f33f
TBoAls6WYA7Zlos22ClNH/uN6HM/YIyGW4BruE45Xr0Fc7fGeaoehOa7bBs9 f8e8
H2V4SgTXiD+GAabbQfUQqNum9R0Q2n3UTRfqWti5YkLmu0GMdWfPO7B4l6V6 0791
M8qqVZLrPTcEuVvTZvHHdBO1yA3nPMxyPRxt+33TnqF2856vaJthlXXE+n5b 7695
249ixXCYW/CN6OHNZgNB6hpxwVT3A6maICg01TAqc4gitH3SH7WCNLu2rQec 7341
bzJWWEwz82Fmm4ymUVks2Ql2Thdh/Q5DEFbZ+wwvdHRI6qVJ/8N7rdN9mwMj 6000
ANsrUDdzP6N5YRi2T7bWrhYeSCAg2TgeKuUmY0yZGhIVJzbpqorMVPD19PPW 1c11
8e1LBBpHmpOlEZyB7gtJs33Xx2gZB9xGsoCojBoP1JtWBtYrfDPfEOdWJCMG 2d2f
wcvVCBs+G95Uda6oACCjKkPMlXJhmQFiRDDRjgzbm1yt6q1XNVra3qtZgq97 5179
o5U/MVgKxFNFr1h+ROK5Rsv2Uj7IVNgOGK1zoB+az9g1BvQMXNXErpGWK6Rt ad26
lXNoWA5tXR/iBjZwrL7ufgAgEBLX8jfedHSSgLrmhNLdkNbCWuL6/RDLmXVv e18e
iZgXCVotF9qDmX5W2vqH0/e/vDsfKIkzr/X5q5r4tksRA4flCqZ2GjXzV5pK e317
1LY/qwKb23C4QRhGkD0lCUrqtOmhu32ybRJ5iGP+51mtAK1hdTs1vida+LuA 3d6f
Qyuj816WYOFieGCrX4rKndKj6msbxKfummy78YZx1FlUZ/JUhF19L2LqNh2r fc9d
QNGw+URJFZFAGyannLkuSQkZZcX139zwnDjCjQ66ZVgRnN4cdJ3eK+Vngl5z 23d5
/9bWbYHGQynZcpq+cdcWMSgAtSG093ew0rFb1C5bKV5IEe176tofMLx3cBqT babc
0Gy3p6P93bQjIY0wE2HLB3fqBcy6998KYwuWmfCHZLMQs2whVsSzlkunQDIR 63ad
AvyVbYHVBw3ZOSSEcNLL7Y1V3ctt4ot7sjV2Rf8pmn/SsNgWqfutiCLKBiOi fe2e
uw0V4UEO11UyXM9Ma/xOHbTKZHQvsGc/c8UavX5PBdZZPhZYjt6gSK06sV+7 48d4
Fdot+B+yZA201UtL6bwt+fTnhWzZjSpoA9TY+m5ukhVC/QGHIVqYStAf8Wmp 55cd
sv7rAqpkdlZlBRBEi/DbSsz0n+P5qsn9FSSIpGSlhar2cHVh6H4x0XcDD/E3 293d
6s76kNEbMapUp+rGdDUOJw3oJbcYlzWymCC8ymTqe5eXrqNY7Z9OZD7MeBGH b8cd
y0JWAnsw9d+x0GGdub0Yi6nC2o3sunM+752+6WCodiR2z5kqKsJ6tPnqVFhu fe2e
GALF01qfrZpZt4bSv0rloCu26LAAdH35QAPwYkfdwdC9jLm83tHdbtt3/w1U cf00
SzAo 905b
"""

fouten = []
stukken = []
for nr, regel in enumerate(BLOK.strip().splitlines(), 1):
    regel = regel.strip()
    if len(regel) < 6 or regel[-5] != ' ':
        fouten.append('regel %d is kapot (vorm)' % nr); continue
    inhoud, crc = regel[:-5], regel[-4:]
    if '%04x' % (binascii.crc32(inhoud.encode()) & 0xffff) != crc:
        fouten.append('regel %d is kapot (controlegetal)' % nr)
    stukken.append(inhoud)
bestanden = {}
if not fouten:
    try:
        bestanden = json.loads(zlib.decompress(base64.b64decode(''.join(stukken))).decode())
    except Exception as e:
        fouten.append('blok uitpakken mislukt: %s' % e)
if not os.path.isdir(MAP):
    fouten.append('map ~/Fibro niet gevonden')
for naam in ('supabase.js', 'crypto.js'):
    if not os.path.exists(os.path.join(MAP, naam)):
        fouten.append('%s ontbreekt in ~/Fibro' % naam)
for naam, md5 in VERWACHT.items():
    if os.path.exists(os.path.join(MAP, naam)):
        fouten.append('%s bestaat al: script is al gedraaid?' % naam)
    elif bestanden and (naam not in bestanden or hashlib.md5(bestanden[naam].encode()).hexdigest() != md5):
        fouten.append('%s: md5 klopt niet na uitpakken' % naam)
if fouten:
    print('FOUT:')
    for f in fouten: print('  - ' + f)
    print('Er is niets aangepast.')
    sys.exit(1)
for naam in VERWACHT:
    inhoud = bestanden[naam]
    with open(os.path.join(MAP, naam), 'wb') as f:
        f.write(inhoud.encode())
    print('GOED: %s gemaakt  %s  (%d regels)' % (naam, hashlib.md5(inhoud.encode()).hexdigest(), inhoud.count('\n')))
