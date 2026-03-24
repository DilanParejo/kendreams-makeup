import os, re, datetime
from functools import wraps
from flask import Flask, jsonify, request, send_from_directory, abort
from flask_cors import CORS
import pymysql
import bcrypt
import jwt
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app, resources={r"/api/*": {"origins": "*"}})

DB_CONFIG = {
    "host":     os.getenv("DB_HOST", "localhost"),
    "port":     int(os.getenv("DB_PORT", 3306)),
    "user":     os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "kendreams"),
    "charset":  "utf8mb4",
    "cursorclass": pymysql.cursors.DictCursor,
    "ssl_disabled": True,
}
JWT_SECRET  = os.getenv("JWT_SECRET", "kendreams_super_secret_2024")
JWT_EXPIRES = datetime.timedelta(hours=24)

def get_db():
    return pymysql.connect(**DB_CONFIG)

def query(sql, params=(), one=False, commit=False):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            if commit:
                conn.commit()
                return cur.lastrowid
            return cur.fetchone() if one else cur.fetchall()
    finally:
        conn.close()

def create_token(user_id, rol):
    payload = {
        "sub": user_id,
        "rol": rol,
        "exp": datetime.datetime.utcnow() + JWT_EXPIRES,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def decode_token(token):
    return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])

def token_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            abort(401, "Token requerido")
        try:
            data = decode_token(auth.split(" ")[1])
        except jwt.ExpiredSignatureError:
            abort(401, "Token expirado")
        except jwt.InvalidTokenError:
            abort(401, "Token invalido")
        request.user_id = data["sub"]
        request.user_rol = data["rol"]
        return f(*args, **kwargs)
    return wrapper

def admin_required(f):
    @wraps(f)
    @token_required
    def wrapper(*args, **kwargs):
        if request.user_rol != "admin":
            abort(403, "Se requiere rol admin")
        return f(*args, **kwargs)
    return wrapper

def ok(data=None, msg="ok", code=200):
    return jsonify({"success": True, "message": msg, "data": data}), code

def err(msg="Error", code=400):
    return jsonify({"success": False, "message": msg}), code

@app.route("/")
@app.route("/<path:path>")
def index(path=""):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.template_folder, "index.html")

@app.route("/api/auth/register", methods=["POST"])
def register():
    d = request.json or {}
    nombre = (d.get("nombre") or "").strip()
    email  = (d.get("email")  or "").strip().lower()
    pwd    = (d.get("password") or "")
    if not nombre or not email or not pwd:
        return err("Nombre, email y contrasena son requeridos")
    if len(pwd) < 6:
        return err("La contrasena debe tener al menos 6 caracteres")
    if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        return err("Email invalido")
    existing = query("SELECT id FROM usuarios WHERE email=%s", (email,), one=True)
    if existing:
        return err("Este email ya esta registrado", 409)
    hashed = bcrypt.hashpw(pwd.encode(), bcrypt.gensalt()).decode()
    uid = query(
        "INSERT INTO usuarios (nombre, email, password) VALUES (%s,%s,%s)",
        (nombre, email, hashed), commit=True
    )
    token = create_token(uid, "cliente")
    return ok({"token": token, "nombre": nombre, "rol": "cliente"}, "Registro exitoso", 201)

@app.route("/api/auth/login", methods=["POST"])
def login():
    d = request.json or {}
    email = (d.get("email") or "").strip().lower()
    pwd   = (d.get("password") or "")
    user = query("SELECT * FROM usuarios WHERE email=%s", (email,), one=True)
    if not user or not bcrypt.checkpw(pwd.encode(), user["password"].encode()):
        return err("Credenciales incorrectas", 401)
    token = create_token(user["id"], user["rol"])
    return ok({"token": token, "nombre": user["nombre"], "rol": user["rol"], "id": user["id"]}, "Login exitoso")

@app.route("/api/auth/me", methods=["GET"])
@token_required
def me():
    user = query("SELECT id, nombre, email, rol, creado_en FROM usuarios WHERE id=%s", (request.user_id,), one=True)
    return ok(user)

@app.route("/api/categorias", methods=["GET"])
def get_categorias():
    cats = query("SELECT * FROM categorias ORDER BY nombre")
    return ok(cats)

@app.route("/api/productos", methods=["GET"])
def get_productos():
    categoria = request.args.get("categoria")
    destacado  = request.args.get("destacado")
    busqueda   = request.args.get("q")
    limite     = int(request.args.get("limit", 100))
    sql = """
        SELECT p.*, c.nombre AS categoria_nombre, c.slug AS categoria_slug, c.emoji
        FROM productos p
        JOIN categorias c ON p.categoria_id = c.id
        WHERE p.activo = 1
    """
    params = []
    if categoria:
        sql += " AND c.slug = %s"
        params.append(categoria)
    if destacado == "1":
        sql += " AND p.destacado = 1"
    if busqueda:
        sql += " AND (p.nombre LIKE %s OR p.descripcion LIKE %s)"
        params += [f"%{busqueda}%", f"%{busqueda}%"]
    sql += " ORDER BY p.destacado DESC, p.nombre LIMIT %s"
    params.append(limite)
    productos = query(sql, params)
    return ok(productos)

@app.route("/api/productos/<int:pid>", methods=["GET"])
def get_producto(pid):
    producto = query("""
        SELECT p.*, c.nombre AS categoria_nombre, c.slug AS categoria_slug, c.emoji
        FROM productos p JOIN categorias c ON p.categoria_id = c.id
        WHERE p.id = %s AND p.activo = 1
    """, (pid,), one=True)
    if not producto:
        return err("Producto no encontrado", 404)
    relacionados = query("""
        SELECT p.id, p.nombre, p.precio, p.imagen_url, c.nombre AS categoria_nombre
        FROM productos p JOIN categorias c ON p.categoria_id = c.id
        WHERE p.categoria_id = %s AND p.id != %s AND p.activo = 1 LIMIT 4
    """, (producto["categoria_id"], pid))
    return ok({"producto": producto, "relacionados": relacionados})

@app.route("/api/pedidos", methods=["POST"])
@token_required
def crear_pedido():
    d = request.json or {}
    items = d.get("items", [])
    if not items:
        return err("El carrito esta vacio")

    nombre_cliente = (d.get("nombre_cliente") or "").strip()
    telefono       = (d.get("telefono") or "").strip()
    direccion      = (d.get("direccion") or "").strip()
    barrio         = (d.get("barrio") or "").strip()
    ciudad         = (d.get("ciudad") or "").strip()
    forma_pago     = (d.get("forma_pago") or "contra_entrega").strip()

    if not nombre_cliente or not telefono or not direccion:
        return err("Nombre, telefono y direccion son obligatorios")
    if forma_pago not in ["contra_entrega", "nequi"]:
        return err("Forma de pago invalida")
    total = 0
    detalle = []
    for item in items:
        prod = query("SELECT * FROM productos WHERE id=%s AND activo=1", (item["producto_id"],), one=True)
        if not prod:
            return err(f"Producto {item['producto_id']} no encontrado")
        if prod["stock"] < item["cantidad"]:
            return err(f"Stock insuficiente para {prod['nombre']}")
        precio = float(prod["precio"])
        total += precio * item["cantidad"]
        detalle.append((prod, item["cantidad"], precio))
    oid = query("""
        INSERT INTO pedidos
          (usuario_id, total, notas, nombre_cliente, telefono, direccion, barrio, ciudad, forma_pago)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (request.user_id, total, d.get("notas",""),
          nombre_cliente, telefono, direccion, barrio, ciudad, forma_pago), commit=True)
    for prod, cant, precio in detalle:
        query("""INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario)
            VALUES (%s,%s,%s,%s)""", (oid, prod["id"], cant, precio), commit=True)
        query("UPDATE productos SET stock = stock - %s WHERE id=%s", (cant, prod["id"]), commit=True)
    return ok({
        "pedido_id": oid,
        "total": total,
        "forma_pago": forma_pago
    }, "Pedido creado", 201)

@app.route("/api/pedidos", methods=["GET"])
@token_required
def mis_pedidos():
    pedidos = query("""
        SELECT p.*, COUNT(d.id) AS num_productos FROM pedidos p
        LEFT JOIN detalle_pedido d ON p.id = d.pedido_id
        WHERE p.usuario_id = %s GROUP BY p.id ORDER BY p.creado_en DESC
    """, (request.user_id,))
    return ok(pedidos)

@app.route("/api/pedidos/<int:oid>", methods=["GET"])
@token_required
def detalle_pedido_get(oid):
    pedido = query("SELECT * FROM pedidos WHERE id=%s AND usuario_id=%s", (oid, request.user_id), one=True)
    if not pedido:
        return err("Pedido no encontrado", 404)
    items = query("""SELECT d.*, pr.nombre, pr.imagen_url FROM detalle_pedido d
        JOIN productos pr ON d.producto_id = pr.id WHERE d.pedido_id = %s""", (oid,))
    return ok({"pedido": pedido, "items": items})

@app.route("/api/admin/pedidos", methods=["GET"])
@admin_required
def admin_pedidos():
    pedidos = query("""
        SELECT p.*, u.nombre AS cliente, u.email, COUNT(d.id) AS num_productos
        FROM pedidos p JOIN usuarios u ON p.usuario_id = u.id
        LEFT JOIN detalle_pedido d ON p.id = d.pedido_id
        GROUP BY p.id ORDER BY p.creado_en DESC
    """)
    return ok(pedidos)

@app.route("/api/admin/pedidos/<int:oid>/estado", methods=["PATCH"])
@admin_required
def cambiar_estado(oid):
    d = request.json or {}
    nuevo_estado = d.get("estado")
    estados_validos = ["pendiente","confirmado","enviado","entregado","cancelado"]
    if nuevo_estado not in estados_validos:
        return err("Estado invalido")
    query("UPDATE pedidos SET estado=%s WHERE id=%s", (nuevo_estado, oid), commit=True)
    return ok(msg="Estado actualizado")
@app.route("/api/pedidos/<int:oid>/verificar-nequi", methods=["PATCH"])
@admin_required
def verificar_nequi(oid):
    pedido = query("SELECT * FROM pedidos WHERE id=%s", (oid,), one=True)
    if not pedido:
        return err("Pedido no encontrado", 404)
    query("UPDATE pedidos SET pago_verificado=1, estado='confirmado' WHERE id=%s", (oid,), commit=True)
    return ok(msg="Pago Nequi verificado y pedido confirmado")
    @app.route("/api/admin/productos", methods=["POST"])
@admin_required
def admin_crear_producto():
    d = request.json or {}
    nombre      = (d.get("nombre") or "").strip()
    descripcion = (d.get("descripcion") or "").strip()
    precio      = d.get("precio")
    stock       = d.get("stock", 0)
    categoria_id = d.get("categoria_id")
    imagen_url  = (d.get("imagen_url") or "").strip()
    destacado   = d.get("destacado", 0)

    if not nombre or not precio or not categoria_id:
        return err("Nombre, precio y categoría son obligatorios")

    pid = query("""
        INSERT INTO productos (nombre, descripcion, precio, stock, categoria_id, imagen_url, destacado, activo)
        VALUES (%s,%s,%s,%s,%s,%s,%s,1)
    """, (nombre, descripcion, precio, stock, categoria_id, imagen_url, destacado), commit=True)
    return ok({"producto_id": pid}, "Producto creado", 201)

@app.route("/api/admin/productos/<int:pid>", methods=["PATCH"])
@admin_required
def admin_actualizar_producto(pid):
    d = request.json or {}
    campos = []
    valores = []
    if "precio" in d:
        campos.append("precio=%s")
        valores.append(d["precio"])
    if "stock" in d:
        campos.append("stock=%s")
        valores.append(d["stock"])
    if "imagen_url" in d:
        campos.append("imagen_url=%s")
        valores.append(d["imagen_url"])
    if "nombre" in d:
        campos.append("nombre=%s")
        valores.append(d["nombre"])
    if "descripcion" in d:
        campos.append("descripcion=%s")
        valores.append(d["descripcion"])
    if "destacado" in d:
        campos.append("destacado=%s")
        valores.append(d["destacado"])
    if not campos:
        return err("Nada que actualizar")
    valores.append(pid)
    query(f"UPDATE productos SET {', '.join(campos)} WHERE id=%s", valores, commit=True)
    return ok(msg="Producto actualizado")

@app.route("/api/admin/productos/<int:pid>", methods=["DELETE"])
@admin_required
def admin_eliminar_producto(pid):
    query("UPDATE productos SET activo=0 WHERE id=%s", (pid,), commit=True)
    return ok(msg="Producto eliminado")
@app.errorhandler(401)
def unauthorized(e): return err(str(e.description or "No autorizado"), 401)
@app.errorhandler(403)
def forbidden(e): return err(str(e.description or "Acceso denegado"), 403)
@app.errorhandler(404)
def not_found(e): return err("Ruta no encontrada", 404)
@app.errorhandler(500)
def server_error(e): return err("Error interno del servidor", 500)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
