# 🏨 Hotel Alejandro - Sistemas III

Este es el proyecto grupal para la materia Sistemas III. Aquí gestionaremos las reservas, huéspedes y la facturación del hotel.

> 🛡️ **Nota del grupo:** Usamos **pnpm** en lugar de npm porque es 3 veces más rápido, no llena el disco duro de la PC y bloquea virus de paquetes infectados automáticamente.

## 👥 Integrantes y Grupos de Trabajo

### 💻 Grupo Backend (Lógica y Base de Datos)

* **Oscari Lucio Agustin**
* **Colque Villalba Agustín Gabriel**
* **Sarmiento Martina Solange**
* **Liendro Enzo Mauricio**

### 🎨 Grupo Frontend (Diseño y Pantallas)

* **Andrada Camila María**
* **Peñalba Genovese Nahuel Carlos**
* **Liendro Enzo Mauricio**

---

## 🚀 Cómo usar el proyecto en tu computadora

### Paso 0: Instalar pnpm (Solo se hace una vez)

Si no tienes pnpm en tu computadora, abre tu terminal y pon este comando:

```bash
npm install -g pnpm

```

### Paso 1: Descargar el proyecto por primera vez

```bash
git clone https://github.com/ItachiUchiha9999/Hotel_Alejandro.git
cd Hotel_Alejandro
git checkout develop

```

### Paso 2: Instalar los archivos del sistema

```bash
pnpm install

```

### Paso 3: Prender el sistema para probarlo

```bash
pnpm run dev

```

---

## 📋 Pasos obligatorios para subir tus cambios a GitHub

Cada vez que termines de programar o cambies algo, abre la terminal en la carpeta del proyecto y pon estos comandos en orden:

### 1. Asegurarte de estar en la rama develop y descargar lo último

Para no borrar el trabajo de tus compañeros, descarga siempre lo último antes de mandar lo tuyo:

```bash
git checkout develop
git pull origin develop

```

### 2. Seleccionar tus archivos cambiados

Guarda en memoria todo lo que modificaste en tu computadora:

```bash
git add .

```

### 3. Ponerle un nombre a tu cambio

Explica resumidamente qué hiciste (usa comillas):

```bash
git commit -m "AQUÍ ESCRIBE QUÉ CAMBIASTE"

```

### 4. Subirlo a la rama develop de GitHub

Envía tus cambios a la rama de desarrollo:

```bash
git push origin develop

```

> 🛑 **ATENCIÓN:** Nunca subas archivos `.env` (credenciales de bases de datos) ni claves privadas de AFIP al repositorio público. Quedan bloqueadas por seguridad.
