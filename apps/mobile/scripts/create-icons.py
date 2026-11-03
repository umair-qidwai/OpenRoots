"""Reproduce the original OpenRoots icon rasters (requires Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw
BASE=Path(__file__).resolve().parents[1]/'assets'/'brand'

def cubic(points, p0, p1, p2, p3):
    for i in range(1,41):
        t=i/40;u=1-t
        points.append(tuple(u**3*p0[j]+3*u*u*t*p1[j]+3*u*t*t*p2[j]+t**3*p3[j] for j in (0,1)))

def render(background):
    image=Image.new('RGBA',(2048,2048),background)
    draw=ImageDraw.Draw(image)
    def line(points):
        points=[(round(x*2),round(y*2)) for x,y in points]
        draw.line(points,fill='#F8F5ED',width=56,joint='curve')
        for x,y in (points[0],points[-1]):draw.ellipse((x-28,y-28,x+28,y+28),fill='#F8F5ED')
    book=[(512,388)]
    cubic(book,(512,388),(436,314),(334,296),(246,322));book.append((246,608))
    cubic(book,(246,608),(334,582),(436,600),(512,674))
    cubic(book,(512,674),(588,600),(690,582),(778,608));book.append((778,322))
    cubic(book,(778,322),(690,296),(588,314),(512,388));line(book)
    for points in [[(512,394),(512,750)],[(512,706),(444,770)],[(512,706),(580,770)]]:line(points)
    for x,y,sign in [(346,398,1),(346,474,1),(678,398,-1),(678,474,-1)]:
        p=[(x,y)];cubic(p,(x,y),(x+sign*36,y+4),(x+sign*70,y+18),(x+sign*104,y+42));line(p)
    return image.resize((1024,1024),Image.Resampling.LANCZOS)

BASE.mkdir(parents=True,exist_ok=True)
render('#245B40').convert('RGB').save(BASE/'icon.png')
render((0,0,0,0)).save(BASE/'adaptive.png')
render('#245B40').resize((64,64),Image.Resampling.LANCZOS).save(BASE/'favicon.png')
print('Generated icon.png (1024 RGB), adaptive.png (1024 RGBA), favicon.png (64 RGBA)')
