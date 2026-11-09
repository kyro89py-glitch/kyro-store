"""Foto de producto limpia a partir de una foto real sobre la cama (sin IA).

- Recorte de la prenda: umbral de luminancia, componente central, huecos rellenos
  (estampados) y refinado con GrabCut; borde suavizado.
- Luz y color: la dominante azul y la falta de exposición se corrigen con ganancias
  globales tomadas del blanco de la propia prenda (la remera real es blanca). El estampado
  recibe las mismas ganancias, así que conserva sus colores relativos.
- Fondo de estudio neutro con sombra suave; lienzo 4:5.
Uso: python3 scripts/limpiar-foto-producto.py entrada.jpg salida.jpg [x y [white|grey]]
  x y: un punto de la prenda (por defecto, el centro). grey: prenda gris sobre fondo azul.
Requiere: numpy, pillow y opencv-python-headless.
"""
import sys
import numpy as np
import cv2
from PIL import Image


def fill_holes(m):
    inv = (m == 0).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(inv, 4)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
    out = m.copy()
    for i in range(1, n):
        if i not in border:
            out[lab == i] = 1
    return out


MODE = 'white'


def segment(img, seed):
    lum = img.mean(2)
    thr = 55
    m = (lum > thr).astype(np.uint8)
    if MODE == 'grey':
        # prenda gris neutra sobre sábana azul: se separa por color, no por luz
        blue = img[..., 2] - np.maximum(img[..., 0], img[..., 1])
        mx, mn = img.max(2), img.min(2)
        sat = (mx - mn) / np.maximum(mx, 1)
        m = ((blue < 6) & (lum > 70)).astype(np.uint8)
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((11, 11), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    sx, sy = seed
    i = lab[sy, sx]
    if i == 0:
        i = 1 + np.argmax(st[1:, 4])
    m = (lab == i).astype(np.uint8)
    m = fill_holes(m)
    # GrabCut para afinar el borde
    gc = np.full(m.shape, cv2.GC_BGD, np.uint8)
    gc[cv2.dilate(m, np.ones((25, 25), np.uint8)) > 0] = cv2.GC_PR_BGD
    gc[m > 0] = cv2.GC_PR_FGD
    gc[cv2.erode(m, np.ones((31, 31), np.uint8)) > 0] = cv2.GC_FGD
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(np.clip(img, 0, 255).astype(np.uint8)[..., ::-1].copy(), gc, None, bgd, fgd, 4, cv2.GC_INIT_WITH_MASK)
    m2 = ((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD)).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m2, 8)
    i = lab[sy, sx] if lab[sy, sx] else 1 + np.argmax(st[1:, 4])
    m2 = fill_holes((lab == i).astype(np.uint8))
    m2 = cv2.morphologyEx(m2, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    m2 = cv2.morphologyEx(m2, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    soft = cv2.GaussianBlur(m2.astype(np.float32), (0, 0), 1.6)
    alpha = np.clip((soft - 0.5) * 2.2 + 0.5, 0, 1)
    return alpha


def flatten_light(img, alpha, strength=0.75, sigma=70):
    # iluminación de baja frecuencia dentro de la prenda (convolución normalizada)
    lum = img.mean(2)
    w = (alpha > 0.98).astype(np.float32)
    num = cv2.GaussianBlur(lum * w, (0, 0), sigma)
    den = cv2.GaussianBlur(w, (0, 0), sigma)
    light = num / np.maximum(den, 1e-3)
    ref = np.percentile(light[w > 0], 80)
    factor = (ref / np.maximum(light, 1)) ** strength
    factor = np.clip(factor, 0.8, 1.9)
    return img * factor[..., None]


def correct(img, alpha):
    img = flatten_light(img, alpha)
    inner = alpha > 0.99
    mx, mn = img.max(2), img.min(2)
    sat = (mx - mn) / np.maximum(mx, 1)
    lum = img.mean(2)
    cand = inner & (sat < 0.12)
    hi = cand & (lum >= np.percentile(lum[cand], 75))
    white = np.median(img[hi], axis=0)
    target = 236.0
    gains = target / white
    if MODE == 'grey':
        # solo se neutraliza la dominante; la luminosidad media de la prenda no cambia
        gains = gains / gains.mean()
    out = np.clip(img * gains, 0, 255)
    print('blanco de la prenda', np.round(white, 1), '-> ganancias', np.round(gains, 3))
    return out


def compose(img, alpha, out_size=(1200, 1500), margin=0.08):
    bottom_cut = alpha[-4:].max() > 0.5
    if bottom_cut:
        out_size = (1200, 1200)
    ys, xs = np.nonzero(alpha > 0.02)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    pad = 20
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(img.shape[1], x1 + pad), min(img.shape[0], y1 + pad)
    if bottom_cut:
        y1 = img.shape[0]
    crop, a = img[y0:y1, x0:x1], alpha[y0:y1, x0:x1]
    W, H = out_size
    s = min(W * (1 - 2 * margin) / crop.shape[1], H * (1 - (1 if bottom_cut else 2) * margin) / crop.shape[0])
    nw, nh = int(crop.shape[1] * s), int(crop.shape[0] * s)
    interp = cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC
    crop = cv2.resize(crop, (nw, nh), interpolation=interp)
    a = cv2.resize(a, (nw, nh), interpolation=interp)
    # fondo de estudio: gris cálido claro con caída suave hacia los bordes
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt(((xx - W / 2) / (W * 0.75)) ** 2 + ((yy - H * 0.45) / (H * 0.75)) ** 2)
    base = np.array([236, 234, 230], np.float32)
    bg = base[None, None, :] * (1 - 0.06 * np.clip(d, 0, 1.4) ** 2)[..., None]
    ox, oy = (W - nw) // 2, (H - nh) // 2
    if bottom_cut:
        # la prenda sale del encuadre por abajo en la foto real: se ancla al borde inferior
        # del lienzo para que se lea como encuadre y no como el bajo de la prenda
        oy = H - nh
    # sombra suave de la prenda
    sh = np.zeros((H, W), np.float32)
    sh[oy:oy + nh, ox:ox + nw] = a
    shifted = np.zeros_like(sh)
    shifted[14:] = sh[:-14]
    sh = cv2.GaussianBlur(shifted, (0, 0), 18) * 0.22
    bg = bg * (1 - sh[..., None])
    full_a = np.zeros((H, W), np.float32)
    full_a[oy:oy + nh, ox:ox + nw] = a
    full_i = np.zeros((H, W, 3), np.float32)
    full_i[oy:oy + nh, ox:ox + nw] = crop
    return bg * (1 - full_a[..., None]) + full_i * full_a[..., None]


def decontaminate(img, alpha):
    # el contorno mezcla tela y sábana: su color se sustituye por el de la tela de dentro
    inner = (alpha > 0.995).astype(np.float32)
    inner = cv2.erode(inner, np.ones((3, 3), np.uint8))
    num = cv2.GaussianBlur(img * inner[..., None], (0, 0), 3)
    den = cv2.GaussianBlur(inner, (0, 0), 3)[..., None]
    ext = num / np.maximum(den, 1e-4)
    band = (alpha > 0.005) & (inner < 1)
    band = cv2.dilate(band.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    out = img.copy()
    out[band & (den[..., 0] > 0.02)] = ext[band & (den[..., 0] > 0.02)]
    a2 = np.clip((alpha - 0.25) / 0.75, 0, 1)
    return out, a2


if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    if len(sys.argv) > 5:
        MODE = sys.argv[5]
    img = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
    seed = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (img.shape[1] // 2, img.shape[0] // 2)
    alpha = segment(img, seed)
    fixed = correct(img, alpha)
    fixed, alpha = decontaminate(fixed, alpha)
    out = compose(fixed, alpha)
    Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8)).save(dst, quality=90, subsampling=0, optimize=True, progressive=True)
    np.save(dst + '.alpha.npy', alpha)
    print('guardado', dst)
