Voici la conception du projet.

## Architecture en plusieurs couches

- La couche CLI démarre et configure le serveur DNS. Elle ne reçoit pas et ne parse pas les requêtes.
- La couche serveur ouvre une socket UDP, reçoit les paquets sous forme d'octets et envoie les réponses.
- Le codec DNS décode les octets reçus en un message DNS exploitable, puis encode la réponse en octets.
- La couche de résolution détermine la réponse à apporter à la question DNS.
- La couche de cache conserve temporairement les réponses selon leur TTL.
- Le système de journalisation permet d'observer le traitement des requêtes.
- Un orchestrateur coordonne ces composants sans contenir leur logique métier.

## Parcours d'une requête avec `dig`

```text
dig @127.0.0.1 -p 5353 example.com A
    ↓
socket UDP du serveur : reçoit les octets
    ↓
codec DNS : décode la requête
    ↓
résolveur : cherche ou construit la réponse
    ↓
codec DNS : encode la réponse
    ↓
socket UDP du serveur : répond à dig
```
