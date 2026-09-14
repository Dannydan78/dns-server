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

```mermaid
sequenceDiagram
    autonumber

    participant Dig as dig
    participant OSClient as Pile réseau du client
    participant Socket as Socket UDP<br/>127.0.0.1:5353
    participant Server as Serveur DNS
    participant Codec as Codec DNS
    participant Resolver as Résolveur

    Dig->>Dig: Construit la requête DNS<br/>example.com / type A
    Dig->>OSClient: Demande l'envoi des octets en UDP

    Note over OSClient,Socket: Paquet IP → 127.0.0.1<br/>Datagramme UDP → port 5353

    OSClient->>Socket: Transmet le datagramme au processus attaché au port
    Socket->>Server: Buffer DNS + IP source + port source
    Server->>Codec: Décode les octets
    Codec-->>Server: Message DNS structuré
    Server->>Resolver: Résout la question DNS
    Resolver-->>Server: Réponse DNS structurée
    Server->>Codec: Encode la réponse
    Codec-->>Server: Buffer de réponse
    Server->>Socket: Envoie le Buffer à l'IP et au port source
    Socket-->>Dig: Datagramme UDP contenant la réponse DNS
```

## Couche CLI

La CLI transforme les arguments fournis au processus en une configuration typée.
Elle ne connaît ni les sockets ni le format des messages DNS.

```text
process.argv
    ↓
parseArguments(args)
    ↓
CliResult
    ├── help  → afficher l'aide
    ├── error → afficher l'erreur et terminer avec le code 1
    └── start → transmettre ServerConfig au futur orchestrateur
```

La configuration de développement par défaut est volontairement locale :

```ts
{
  host: "127.0.0.1",
  port: 5353
}
```

Exemples :

```bash
npm run dev -- --help
npm run dev -- --host 127.0.0.1 --port 5353
```
