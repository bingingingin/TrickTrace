"""Download OFL font sources; run subset_fonts.py to create public WOFF2 assets."""
from pathlib import Path
import urllib.request,re,concurrent.futures
root=Path(__file__).resolve().parents[1];out=root/'.tools/fonts/noto-source';out.mkdir(parents=True,exist_ok=True)
url='https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;600&display=swap'
req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36'})
css=urllib.request.urlopen(req).read().decode();urls=sorted(set(re.findall(r'url\((https://[^)]+)\)',css)))
def download(url):
 name=url.rsplit('/',1)[-1];path=out/name
 if not path.exists():path.write_bytes(urllib.request.urlopen(url).read())
 return url,name
list(concurrent.futures.ThreadPoolExecutor(max_workers=8).map(download,urls))
license_url='https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/OFL.txt'
public=root/'public/fonts';public.mkdir(parents=True,exist_ok=True)
(public/'OFL.txt').write_bytes(urllib.request.urlopen(license_url).read())
print('Downloaded',len(urls),'font sources; run scripts/subset_fonts.py next')
