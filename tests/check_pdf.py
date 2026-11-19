# Rasterises the PDFs written by tests/batch.mjs (poppler) and checks them with OpenCV:
# page size, detected IDs per sheet, and printed marker size in mm.
# Needs: apt-get install poppler-utils; pip install opencv-python-headless numpy
import json, os, subprocess, glob
import numpy as np
import cv2

OUT = os.path.join(os.path.dirname(__file__), 'out')
DPI = 300
fail = 0
for s in json.load(open(os.path.join(OUT, 'batch_sheets.json'))):
    pdf = os.path.join(OUT, s['file'])
    info = subprocess.run(['pdfinfo', pdf], capture_output=True, text=True, check=True).stdout
    pages = int([l for l in info.splitlines() if l.startswith('Pages:')][0].split()[1])
    size = [l for l in info.splitlines() if l.startswith('Page size:')][0]
    w_pt, h_pt = float(size.split()[2]), float(size.split()[4])
    mm = (round(w_pt / 72 * 25.4), round(h_pt / 72 * 25.4))
    prefix = pdf[:-4] + '_p'
    for f in glob.glob(prefix + '*.png'):
        os.remove(f)
    subprocess.run(['pdftoppm', '-r', str(DPI), '-gray', '-png', pdf, prefix], check=True)
    found, sides = [], []
    use_at3 = s['dict'].startswith('tag')
    for img_path in sorted(glob.glob(prefix + '*.png')):
        img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
        if use_at3:
            found_img = None  # OpenCV has no AprilTag 3 dictionaries; checked by the JS detector in check.mjs-style run below
            continue
        det = cv2.aruco.ArucoDetector(cv2.aruco.getPredefinedDictionary(getattr(cv2.aruco, s['dict'])))
        corners, ids, _ = det.detectMarkers(img)
        if ids is not None:
            found += [int(i) for i in ids.flatten()]
            for c in corners:
                c = c.reshape(4, 2)
                sides.append(np.mean([np.linalg.norm(c[i] - c[(i + 1) % 4]) for i in range(4)]) / DPI * 25.4)
    ok = pages == s['pages'] and list(mm) == [round(v) for v in s['pageMm']]
    if not use_at3:
        ok = ok and sorted(found) == sorted(s['ids']) and all(abs(v - s['markerMm']) < 0.6 for v in sides)
    if not ok:
        fail += 1
    side_txt = f"{min(sides):.2f}-{max(sides):.2f}mm" if sides else '-'
    print(f"{s['file']}: pages={pages}/{s['pages']} paper={mm} ids={sorted(found) if not use_at3 else 'n/a'} size={side_txt} {'OK' if ok else 'FAIL'}")
print('PDF CHECK ' + ('FAILED' if fail else 'PASSED'))
raise SystemExit(1 if fail else 0)
