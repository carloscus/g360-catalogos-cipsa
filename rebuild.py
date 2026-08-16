import fitz, os
base = r'C:\Users\ccusi\Documents\Proyect_Coder\G360-ecosystem\projects\g360-catalogos-CIPSA'
images_dir = os.path.join(base, 'images')
catalogs_dir = os.path.join(base, 'catalogs')

for f in os.listdir(catalogs_dir):
    if f.endswith('.pdf'):
        os.remove(os.path.join(catalogs_dir, f))

mapping = [
    ('vinifan', 'catalogo-1.pdf'),
    ('viniball', 'catalogo-2.pdf'),
    ('representadas', 'catalogo-3.pdf'),
    ('institucional', 'catalogo-4.pdf'),
    ('industriales', 'catalogo-5.pdf'),
]

for theme, pdf_name in mapping:
    img_folder = os.path.join(images_dir, theme)
    imgs = sorted([f for f in os.listdir(img_folder) if f.startswith('page_') and f.endswith('.jpg')])
    
    doc = fitz.open()
    for img in imgs:
        img_path = os.path.join(img_folder, img)
        pix = fitz.Pixmap(img_path)
        if pix.n > 4:
            pix = fitz.Pixmap(fitz.csRGB, pix)
        rect = fitz.Rect(0, 0, pix.width, pix.height)
        page = doc.new_page(width=pix.width, height=pix.height)
        page.insert_image(rect, filename=img_path)
    
    out_path = os.path.join(catalogs_dir, pdf_name)
    doc.save(out_path, deflate=True)
    doc.close()
    size_mb = round(os.path.getsize(out_path) / (1024*1024), 2)
    print(f'{pdf_name}: {len(imgs)} pages, {size_mb} MB')
