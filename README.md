# catchdos

Presentación en vivo **Capital Humano Live** (Catch Consulting).

## Archivos

- `index.html` — aplicación (presentador y cliente)
- `avatar.mp4` — video/audio del avatar IA
- `favicon.png` — icono

## Uso local

Sirve la carpeta con cualquier servidor estático y abre `index.html`:

```bash
python3 -m http.server 8080
```

Luego abre `http://localhost:8080/` y elige vista presentador o cliente.

- Presentador: `?vista=presentador`
- Cliente: `?vista=cliente`
