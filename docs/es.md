# BorgBase

## Presentación

Esta integración vigila en Gladys los repositorios de copias de una cuenta **BorgBase** (alojamiento externo para BorgBackup y restic): el tamaño de cada repositorio, su cuota, el tiempo desde su última copia y el espacio usado por la cuenta. Le avisa, mediante sus escenas, cuando una copia deja de llegar o una cuota se llena. Lee la API GraphQL oficial de BorgBase con un token de API **Read Only** y no modifica nada en su cuenta.

Cada repositorio se convierte en un dispositivo, y la cuenta también. Los disparadores de escena reaccionan a una copia nueva, a una copia atrasada, a la reanudación de las copias y a una cuota que alcanza el 80, 90 o 100 %.

Transporte: nube. Solo se contacta `api.borgbase.com`, cada 15 minutos por defecto; sus copias nunca pasan por Gladys.

BorgBase es un servicio de BorgBase Ltd. Esta integración no está afiliada a BorgBase.

## Requisitos

- Gladys Assistant 5.3.0 o posterior.
- Una cuenta BorgBase con al menos un repositorio.
- Un token de API: en borgbase.com, abra **Account → API**, cree un token con el permiso **Read Only** (suficiente, y el más seguro), dele una fecha de caducidad si lo desea y cópielo.

## Configuración

| Campo                       | Función                                                                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Token de API                | El token Read Only.                                                                                                              |
| Atrasada después de (horas) | Para los repositorios sin supervisión de BorgBase: 26 por defecto (una copia diaria). Un repositorio supervisado usa sus X días. |
| Intervalo de lectura (s)    | De 300 a 3600 segundos, 900 por defecto; también el retardo de los disparadores de escena.                                       |
| Idioma de los textos        | Nombres de los dispositivos, resúmenes y salidas de las escenas; automático por defecto.                                         |

Guarde y pulse **Probar la conexión**: indica cuántos repositorios se han leído y cuántos tienen una copia atrasada.

Un repositorio está **atrasado** cuando lleva más tiempo que su plazo sin recibir una copia nueva: la **supervisión** del repositorio en BorgBase (**Edit repository → Monitoring: X días**) si está activa, si no el campo **Atrasada después de**. Un repositorio en el que nunca se ha escrito cuenta desde su creación.

## Uso

### Dispositivos

En **Descubrimiento**, cree los dispositivos que quiera:

- **Cuenta BorgBase <correo>**: espacio usado (GB), límite de almacenamiento usado (%), repositorios, copias atrasadas.
- **BorgBase <repositorio>**: tamaño del repositorio (GB), cuota usada (%, solo si el repositorio tiene cuota), tiempo desde la última copia (horas).

Gladys guarda su historial: compare «Tiempo desde la última copia» con cualquier plazo en una condición de escena, o dibuje el tamaño en un gráfico. Un valor que BorgBase no da se omite, nunca se pone a 0.

### Disparadores de escena

Todos filtran por dispositivo (déjelo vacío para cualquiera):

- **Nueva copia**: se escribió en un repositorio. BorgBase da la hora de la última escritura: una purga (prune) o una compactación también cuentan.
- **Copia atrasada**: un repositorio no ha recibido ninguna copia nueva en su plazo (variables `hours_since_backup`, `threshold_hours`).
- **Copias reanudadas**: un repositorio atrasado ha vuelto a recibir una copia.
- **Nivel de cuota alcanzado**: un repositorio (de su cuota) o la cuenta (de su límite de almacenamiento) alcanza el 80, 90 o 100 %; filtros por nivel y ámbito.

Cada evento da el dispositivo, el nombre del repositorio, su tamaño y una frase `summary`. La primera lectura tras un arranque, un token nuevo o un plazo nuevo es una referencia: no se dispara nada.

Ejemplos:

- Cuando se dispara **Copia atrasada** → enviar el `summary` a su teléfono.
- Cuando **Nivel de cuota alcanzado** al 90 % para la cuenta → enviar un mensaje para pensar en el plan.
- Cada lunes a las 9 → **Leer la cuenta** y luego enviar su `summary`.

### Acciones de escena

- **Leer un repositorio** da su estado (`ok`, `overdue`, `never`), tamaño, cuota, horas desde la última copia y una frase `summary`. Un número desconocido vale -1.
- **Leer la cuenta** da el plan, el espacio usado, el límite de almacenamiento, los repositorios atrasados y una frase `summary`.

### Widgets

![El widget BorgBase con el indicador de almacenamiento, tres mosaicos y los repositorios que requieren atención, el widget de repositorios de copias con una insignia por repositorio y el widget de espacio con el historial del tamaño de un repositorio (ilustración generada, no una captura de pantalla)](https://raw.githubusercontent.com/William-De71/gladys-borgbase/main/docs/assets/widgets.es.png)

- **BorgBase**: límite de almacenamiento usado, espacio usado, repositorios, copias atrasadas, los repositorios que requieren atención (atrasados, cuota al 90 % o más) y un enlace a BorgBase.
- **Repositorios de copias**: cada repositorio con su tamaño, cuota, última copia y una insignia; primero lo que requiere atención, por nombre o los más grandes primero.
- **Espacio BorgBase**: el historial del tamaño de un repositorio o de toda la cuenta. Es el historial que guarda Gladys: cree primero el dispositivo.

## Solución de problemas

- **«BorgBase rechaza el token de API»**: el token es incorrecto, ha caducado o se ha eliminado: cree uno nuevo en **Account → API**.
- **«El token no puede leer la cuenta»**: el token solo lee los repositorios; el dispositivo de la cuenta y el límite de almacenamiento se omiten.
- **«BorgBase pide reducir el ritmo»**: aumente el intervalo de lectura.
- **Una copia aparece atrasada demasiado pronto**: compruebe la **supervisión** del repositorio en BorgBase, o aumente **Atrasada después de**.
- Informe de un problema con las versiones de Gladys y de la integración y sus registros; nunca pegue su token.
