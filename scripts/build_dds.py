"""Reproducible standalone DDS3 builds. Run from repo root; emsdk lives in .tools/."""
from pathlib import Path
import subprocess, sys, os, concurrent.futures, shutil
root=Path(__file__).resolve().parents[1]
src=root/'vendor/dds/library/src'
native='--native' in sys.argv
compiler=shutil.which('g++') if native else str(root/'.tools/emsdk/upstream/emscripten/em++.bat' if os.name=='nt' else root/'.tools/emsdk/upstream/emscripten/em++')
out=root/('artifacts/native' if native else 'public/dds')
out.mkdir(parents=True,exist_ok=True)
cache=root/('.cache/native' if native else '.cache/wasm');cache.mkdir(parents=True,exist_ok=True)
flags=['-std=c++20','-O2','-DNDEBUG','-I'+str(src)]
if not native: flags+=['-fexceptions']
sources=sorted(src.rglob('*.cpp'))+[root/'native/bridge.cpp']
def compile_one(p):
 obj=cache/(str(p.relative_to(root)).replace('/','_').replace('\\','_')+'.o')
 if not obj.exists() or obj.stat().st_mtime<p.stat().st_mtime:
  r=subprocess.run([compiler,*flags,'-c',str(p),'-o',str(obj)],capture_output=True,text=True)
  if r.returncode:raise RuntimeError(str(p)+'\n'+r.stdout+r.stderr)
 return str(obj)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: objects=list(pool.map(compile_one,sources))
args=[compiler,*flags,*objects]
if native: args+=['-static','-o',str(out/'dds-reference.exe')]
else:args+=['--no-entry','-sMODULARIZE=1','-sEXPORT_ES6=1','-sEXPORT_NAME=createDDS','-sENVIRONMENT=web,worker,node','-sALLOW_MEMORY_GROWTH=1','-sINITIAL_MEMORY=33554432','-sMAXIMUM_MEMORY=536870912','-sSTACK_SIZE=8388608','-sDISABLE_EXCEPTION_CATCHING=0','-sEXPORTED_FUNCTIONS=["_tt_solve","_tt_par"]','-sEXPORTED_RUNTIME_METHODS=["ccall"]','-o',str(out/'dds.mjs')]
subprocess.run(args,check=True)
shutil.copyfile(root/'vendor/dds/LICENSE',out/'LICENSE.txt')
print('DDS built:',out)
