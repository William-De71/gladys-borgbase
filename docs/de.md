# BorgBase

## Überblick

Diese Integration überwacht in Gladys die Sicherungs-Repositories eines **BorgBase**-Kontos (Offsite-Hosting für BorgBackup und restic): die Größe jedes Repositorys, sein Kontingent, die Zeit seit der letzten Sicherung und den belegten Speicher des Kontos. Sie warnt dich über deine Szenen, wenn keine Sicherung mehr ankommt oder ein Kontingent voll wird. Sie liest die offizielle GraphQL-API von BorgBase mit einem **Read-Only**-API-Token und ändert nichts an deinem Konto.

Jedes Repository wird ein Gerät, das Konto ebenfalls. Szenenauslöser reagieren auf eine neue Sicherung, eine überfällige Sicherung, wieder laufende Sicherungen und ein Kontingent, das 80, 90 oder 100 % erreicht.

Transport: Cloud. Nur `api.borgbase.com` wird kontaktiert, standardmäßig alle 15 Minuten; deine Sicherungen laufen nie über Gladys.

BorgBase ist ein Dienst der BorgBase Ltd. Diese Integration ist nicht mit BorgBase verbunden.

## Voraussetzungen

- Gladys Assistant 5.3.0 oder neuer.
- Ein BorgBase-Konto mit mindestens einem Repository.
- Ein API-Token: Öffne auf borgbase.com **Account → API**, erstelle ein Token mit der Berechtigung **Read Only** (reicht und ist am sichersten), gib ihm bei Bedarf ein Ablaufdatum und kopiere es.

## Konfiguration

| Feld                      | Zweck                                                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| API-Token                 | Das Read-Only-Token.                                                                                                              |
| Überfällig nach (Stunden) | Für Repositories ohne BorgBase-Überwachung: standardmäßig 26 (tägliche Sicherung). Ein überwachtes Repository nutzt seine X Tage. |
| Abfrageintervall (s)      | 300 bis 3.600 Sekunden, standardmäßig 900; auch die Reaktionszeit der Szenenauslöser.                                             |
| Sprache der Texte         | Gerätenamen, Zusammenfassungen und Ausgaben der Szenen; standardmäßig automatisch.                                                |

Speichere und drücke dann **Verbindung testen**: Es zeigt, wie viele Repositories gelesen wurden und wie viele eine überfällige Sicherung haben.

Ein Repository ist **überfällig**, wenn es länger als seine Frist keine neue Sicherung erhalten hat: die **Überwachung** des Repositorys auf BorgBase (**Edit repository → Monitoring: X Tage**), wenn sie aktiv ist, sonst das Feld **Überfällig nach**. Ein nie beschriebenes Repository zählt ab seiner Erstellung.

## Verwendung

### Geräte

Erstelle unter **Erkennung** die gewünschten Geräte:

- **BorgBase-Konto <E-Mail>**: belegter Speicher (GB), Speicherlimit belegt (%), Repositories, überfällige Sicherungen.
- **BorgBase <Repository>**: Repository-Größe (GB), Kontingent belegt (%, nur mit Kontingent), Zeit seit der letzten Sicherung (Stunden).

Gladys speichert ihren Verlauf: Vergleiche „Zeit seit der letzten Sicherung“ in einer Szenenbedingung mit jeder Frist oder zeige die Größe in einem Diagramm. Ein Wert, den BorgBase nicht liefert, wird weggelassen, nie auf 0 gesetzt.

### Szenenauslöser

Alle filtern nach Gerät (leer lassen für alle):

- **Neue Sicherung**: In ein Repository wurde geschrieben. BorgBase liefert die Zeit des letzten Schreibvorgangs, daher zählen auch ein Prune oder eine Komprimierung.
- **Sicherung überfällig**: Ein Repository hat in seiner Frist keine neue Sicherung erhalten (Variablen `hours_since_backup`, `threshold_hours`).
- **Sicherungen wieder da**: Ein überfälliges Repository hat wieder eine Sicherung erhalten.
- **Kontingentstufe erreicht**: Ein Repository (seines Kontingents) oder das Konto (seines Speicherlimits) erreicht 80, 90 oder 100 %; Filter auf Stufe und Bereich.

Jedes Ereignis liefert das Gerät, den Repository-Namen, seine Größe und einen Satz `summary`. Die erste Abfrage nach einem Start, einem neuen Token oder einer neuen Frist ist eine Referenz: Nichts wird ausgelöst.

Beispiele:

- Wenn **Sicherung überfällig** auslöst → den `summary` an dein Handy senden.
- Wenn **Kontingentstufe erreicht** bei 90 % für das Konto → eine Nachricht senden, um an den Tarif zu denken.
- Jeden Montag um 9 Uhr → **Konto lesen**, dann seinen `summary` senden.

### Szenenaktionen

- **Repository lesen** liefert seinen Status (`ok`, `overdue`, `never`), Größe, Kontingent, Stunden seit der letzten Sicherung und einen Satz `summary`. Eine unbekannte Zahl ist -1.
- **Konto lesen** liefert den Tarif, den belegten Speicher, das Speicherlimit, die überfälligen Repositories und einen Satz `summary`.

### Widgets

![Das BorgBase-Widget mit der Speicheranzeige, drei Kacheln und den offenen Punkten, das Widget der Sicherungs-Repositories mit einem Badge pro Repository und das Belegungs-Widget mit dem Größenverlauf eines Repositorys (generierte Illustration, kein Screenshot)](https://raw.githubusercontent.com/William-De71/gladys-borgbase/main/docs/assets/widgets.de.png)

- **BorgBase**: Speicherlimit belegt, belegter Speicher, Repositories, überfällige Sicherungen, die Repositories mit offenen Punkten (überfällig, Kontingent ab 90 %) und ein Link zu BorgBase.
- **Sicherungs-Repositories**: jedes Repository mit Größe, Kontingent, letzter Sicherung und einem Badge; offene Punkte zuerst, nach Name oder größte zuerst.
- **BorgBase-Belegung**: der Größenverlauf eines Repositorys oder des ganzen Kontos. Es ist der Verlauf, den Gladys speichert: Erstelle zuerst das Gerät.

## Fehlerbehebung

- **„BorgBase lehnt das API-Token ab“**: Das Token ist falsch, abgelaufen oder gelöscht: Erstelle ein neues unter **Account → API**.
- **„Das Token kann das Konto nicht lesen“**: Das Token liest nur die Repositories; das Kontogerät und das Speicherlimit fehlen.
- **„BorgBase bittet um weniger Anfragen“**: Erhöhe das Abfrageintervall.
- **Eine Sicherung ist zu früh überfällig**: Prüfe die **Überwachung** des Repositorys auf BorgBase oder erhöhe **Überfällig nach**.
- Melde ein Problem mit den Versionen von Gladys und der Integration und ihren Logs; füge nie dein Token ein.
