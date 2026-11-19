# Generates reference data with OpenCV (cv2.aruco) for tests/check.mjs.
# Run in a python container:  pip install opencv-python-headless numpy && python tests/make_cv_fixtures.py
import json, os, random
import numpy as np
import cv2

OUT = os.path.join(os.path.dirname(__file__), 'out')
os.makedirs(OUT, exist_ok=True)
random.seed(1)
np.random.seed(1)

DICTS = ['DICT_4X4_50', 'DICT_4X4_1000', 'DICT_5X5_100', 'DICT_6X6_250', 'DICT_7X7_1000',
         'DICT_ARUCO_ORIGINAL', 'DICT_ARUCO_MIP_36h12', 'DICT_APRILTAG_16h5', 'DICT_APRILTAG_25h9',
         'DICT_APRILTAG_36h10', 'DICT_APRILTAG_36h11']

# 1) bit patterns: marker image with 1px per cell, borderBits=1
bits = {}
for name in DICTS:
    d = cv2.aruco.getPredefinedDictionary(getattr(cv2.aruco, name))
    n = d.markerSize
    count = d.bytesList.shape[0]
    ids = sorted(set([0, 1, 2, count - 1] + random.sample(range(count), min(10, count))))
    bits[name] = {}
    for i in ids:
        img = cv2.aruco.generateImageMarker(d, i, n + 2, borderBits=1)
        bits[name][i] = ''.join('1' if v > 127 else '0' for v in img[1:-1, 1:-1].flatten())
json.dump(bits, open(os.path.join(OUT, 'bits.json'), 'w'))

# 2) scenes with perspective-warped markers
def scene(idx, specs, size=(1280, 960), blur=0, noise=0, bg=200):
    W, H = size
    canvas = np.full((H, W), bg, np.uint8)
    # gradient background
    canvas = (canvas.astype(np.float32) * np.linspace(0.75, 1.1, W)[None, :]).clip(0, 255).astype(np.uint8)
    truth = []
    for name, mid, cx, cy, side, angle, tilt in specs:
        d = cv2.aruco.getPredefinedDictionary(getattr(cv2.aruco, name))
        T = d.markerSize + 2
        cell = 20
        m = cv2.aruco.generateImageMarker(d, mid, T * cell, borderBits=1)
        q = cell  # white quiet zone
        m = cv2.copyMakeBorder(m, q, q, q, q, cv2.BORDER_CONSTANT, value=255)
        S = m.shape[0]
        src = np.float32([[0, 0], [S, 0], [S, S], [0, S]])
        a = np.deg2rad(angle)
        half = side / 2 * S / (T * cell)
        base = np.array([[-half, -half], [half, -half], [half, half], [-half, half]])
        base[:, 0] *= np.where(base[:, 1] < 0, 1 - tilt, 1 + tilt)  # trapezoid tilt
        R = np.array([[np.cos(a), -np.sin(a)], [np.sin(a), np.cos(a)]])
        dst = (base @ R.T + [cx, cy]).astype(np.float32)
        M = cv2.getPerspectiveTransform(src, dst)
        warped = cv2.warpPerspective(m, M, (W, H), flags=cv2.INTER_LINEAR, borderValue=0)
        mask = cv2.warpPerspective(np.full_like(m, 255), M, (W, H), flags=cv2.INTER_NEAREST, borderValue=0)
        canvas[mask > 0] = warped[mask > 0]
        inner = np.float32([[q, q], [S - q, q], [S - q, S - q], [q, S - q]]).reshape(-1, 1, 2)
        corners = cv2.perspectiveTransform(inner, M).reshape(-1, 2).tolist()
        truth.append({'dict': name, 'id': mid, 'corners': corners})
    if blur:
        canvas = cv2.GaussianBlur(canvas, (0, 0), blur)
    if noise:
        canvas = np.clip(canvas.astype(np.float32) + np.random.normal(0, noise, canvas.shape), 0, 255).astype(np.uint8)
    fn = f'scene{idx}.png'
    cv2.imwrite(os.path.join(OUT, fn), cv2.cvtColor(canvas, cv2.COLOR_GRAY2BGR))
    # OpenCV's own detection as a reference
    found = {}
    for name in set(s[0] for s in specs):
        det = cv2.aruco.ArucoDetector(cv2.aruco.getPredefinedDictionary(getattr(cv2.aruco, name)))
        c, ids, _ = det.detectMarkers(canvas)
        found[name] = [] if ids is None else sorted(int(i) for i in ids.flatten())
    return {'file': fn, 'truth': truth, 'opencv': found}

scenes = []
scenes.append(scene(0, [('DICT_4X4_50', 7, 250, 250, 260, 0, 0), ('DICT_6X6_250', 123, 800, 300, 300, 30, 0.1),
                        ('DICT_APRILTAG_36h11', 42, 400, 700, 220, -60, 0.2), ('DICT_5X5_100', 99, 1000, 720, 180, 95, 0.0)]))
scenes.append(scene(1, [('DICT_7X7_1000', 777, 350, 350, 400, 15, 0.25), ('DICT_ARUCO_ORIGINAL', 1000, 900, 400, 260, 200, 0.1),
                        ('DICT_APRILTAG_16h5', 29, 800, 780, 150, 10, 0.0)], blur=1.2, noise=6))
scenes.append(scene(2, [('DICT_ARUCO_MIP_36h12', 200, 300, 300, 120, 45, 0.0), ('DICT_APRILTAG_25h9', 3, 700, 300, 90, 170, 0.15),
                        ('DICT_APRILTAG_36h10', 2000, 500, 700, 140, -20, 0.3), ('DICT_4X4_1000', 999, 1050, 650, 70, 5, 0.0)], blur=0.8, noise=4))
# 3) AprilTag 3 scenes built from the official images (tests/out/at3, from AprilRobotics/apriltag-imgs)
AT3 = {'tagCircle21h7': ('tag21_07', 9, 5), 'tagCircle49h12': ('tag49_12', 11, 5), 'tagCustom48h12': ('tag48_12', 10, 6),
       'tagStandard41h12': ('tag41_12', 9, 5), 'tagStandard52h13': ('tag52_13', 10, 6)}

def at3_scene(idx, specs, size=(1280, 960), blur=0, noise=0):
    W, H = size
    canvas = (np.full((H, W), 190, np.float32) * np.linspace(0.8, 1.1, W)[None, :]).clip(0, 255).astype(np.uint8)
    truth = []
    for name, mid, cx, cy, side, angle, tilt in specs:
        prefix, T, Wb = AT3[name]
        png = cv2.imread(os.path.join(OUT, 'at3', f'{prefix}_{mid:05d}.png'), cv2.IMREAD_UNCHANGED)
        gray = cv2.cvtColor(png[:, :, :3], cv2.COLOR_BGR2GRAY)
        gray[png[:, :, 3] < 128] = 255  # transparent (unused) cells -> white
        cell = 20
        m = cv2.resize(gray, (T * cell, T * cell), interpolation=cv2.INTER_NEAREST)
        m = cv2.copyMakeBorder(m, cell, cell, cell, cell, cv2.BORDER_CONSTANT, value=255)
        S = m.shape[0]
        src = np.float32([[0, 0], [S, 0], [S, S], [0, S]])
        a = np.deg2rad(angle)
        half = side / 2 * S / (T * cell)
        base = np.array([[-half, -half], [half, -half], [half, half], [-half, half]])
        base[:, 0] *= np.where(base[:, 1] < 0, 1 - tilt, 1 + tilt)
        R = np.array([[np.cos(a), -np.sin(a)], [np.sin(a), np.cos(a)]])
        dst = (base @ R.T + [cx, cy]).astype(np.float32)
        M = cv2.getPerspectiveTransform(src, dst)
        warped = cv2.warpPerspective(m, M, (W, H), flags=cv2.INTER_LINEAR, borderValue=0)
        mask = cv2.warpPerspective(np.full_like(m, 255), M, (W, H), flags=cv2.INTER_NEAREST, borderValue=0)
        canvas[mask > 0] = warped[mask > 0]
        o0 = cell + (T - Wb) // 2 * cell
        o1 = o0 + Wb * cell
        inner = np.float32([[o0, o0], [o1, o0], [o1, o1], [o0, o1]]).reshape(-1, 1, 2)
        truth.append({'dict': name, 'id': mid, 'corners': cv2.perspectiveTransform(inner, M).reshape(-1, 2).tolist()})
    if blur:
        canvas = cv2.GaussianBlur(canvas, (0, 0), blur)
    if noise:
        canvas = np.clip(canvas.astype(np.float32) + np.random.normal(0, noise, canvas.shape), 0, 255).astype(np.uint8)
    fn = f'scene{idx}.png'
    cv2.imwrite(os.path.join(OUT, fn), cv2.cvtColor(canvas, cv2.COLOR_GRAY2BGR))
    return {'file': fn, 'truth': truth, 'opencv': {}}

if os.path.isdir(os.path.join(OUT, 'at3')):
    scenes.append(at3_scene(3, [('tagStandard41h12', 17, 300, 280, 300, 20, 0.1), ('tagCircle21h7', 37, 850, 260, 260, -100, 0.2),
                                ('tagCustom48h12', 1, 350, 720, 260, 185, 0.0), ('tagStandard52h13', 37, 950, 700, 300, 60, 0.15)], blur=1.0, noise=5))
    scenes.append(at3_scene(4, [('tagCircle49h12', 17, 400, 450, 380, -30, 0.2), ('tagStandard41h12', 0, 950, 300, 160, 90, 0.0),
                                ('tagCustom48h12', 37, 950, 720, 220, 10, 0.25)], blur=0.7, noise=3))

json.dump(scenes, open(os.path.join(OUT, 'scenes.json'), 'w'), indent=1)
print('ok', [s['opencv'] for s in scenes])
