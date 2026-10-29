import sys
def h(l):
    x=0
    for ch in l: x=(x*31+ord(ch))&0xFFFFFFFF
    return x
L=[l for l in open(sys.argv[1],encoding='utf-8').read().split('\n') if l]
per=[h(l) for l in L]
print(len(L), sum(per)&0xFFFFFFFF)
if len(sys.argv)>2:
    exp=[int(x) for x in sys.argv[2].split(',')]
    for i,(a,b) in enumerate(zip(per,exp)):
        if a!=b: print('DIFF',i,L[i][:60])
