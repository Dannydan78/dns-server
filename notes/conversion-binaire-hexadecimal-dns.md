---
title: Conversion binaire, hexadécimale et flags DNS
tags:
  - dns
  - réseau
  - binaire
  - cybersécurité
---

# Conversion binaire, hexadécimale et flags DNS

## Modèle mental

Un bit est une case qui ne peut contenir que `0` ou `1`.

```text
0 → désactivé
1 → activé
```

Un groupe de 4 bits est appelé un **nibble**. Un chiffre hexadécimal représente
exactement un nibble :

```text
1 chiffre hexadécimal = 4 bits
2 chiffres hexadécimaux = 1 octet = 8 bits
4 chiffres hexadécimaux = 2 octets = 16 bits
```

Le préfixe `0x` indique qu'un nombre est écrit en hexadécimal :

```text
0x8    → un chiffre hexadécimal
0x81   → un octet
0x8180 → deux octets, donc 16 bits
```

## Tableau de conversion

| Décimal | Hexadécimal | Binaire |
|--------:|:------------:|:-------:|
| 0  | `0` | `0000` |
| 1  | `1` | `0001` |
| 2  | `2` | `0010` |
| 3  | `3` | `0011` |
| 4  | `4` | `0100` |
| 5  | `5` | `0101` |
| 6  | `6` | `0110` |
| 7  | `7` | `0111` |
| 8  | `8` | `1000` |
| 9  | `9` | `1001` |
| 10 | `A` | `1010` |
| 11 | `B` | `1011` |
| 12 | `C` | `1100` |
| 13 | `D` | `1101` |
| 14 | `E` | `1110` |
| 15 | `F` | `1111` |

Après `9`, l'hexadécimal utilise les lettres `A` à `F` pour représenter les
valeurs décimales `10` à `15`.

## Convertir de l'hexadécimal vers le binaire

Il faut convertir chaque chiffre séparément en quatre bits, puis concaténer les
résultats.

Exemple :

```text
0x2A

2 → 0010
A → 1010

0x2A → 0010 1010
```

Avec un entier DNS de 16 bits :

```text
0x1234

1 → 0001
2 → 0010
3 → 0011
4 → 0100

0x1234 → 0001 0010 0011 0100
```

## Convertir du binaire vers le décimal

Chaque position possède une valeur qui est une puissance de deux. Pour quatre
bits :

```text
Position :  3   2   1   0
Valeur   :  8   4   2   1
```

On additionne uniquement les valeurs placées sous les bits à `1` :

```text
1010

1 × 8 = 8
0 × 4 = 0
1 × 2 = 2
0 × 1 = 0

8 + 2 = 10
```

Donc :

```text
1010₂ = 10₁₀ = A₁₆
```

## Lire un champ de bits

Un protocole définit comment les bits doivent être découpés. Les séparateurs ne
sont pas transmis sur le réseau : ils sont décrits par la spécification.

Exemple fictif d'un octet composé de trois champs :

```text
Structure : A |  B  |   C
Taille    : 1 |  3  | 4 bits
Valeur    : 1 | 011 | 0110
```

Il faut donc toujours connaître :

1. la position du champ ;
2. sa taille en bits ;
3. la signification de sa valeur.

## Structure des flags DNS

Le champ `FLAGS` d'un en-tête DNS contient 16 bits :

```text
Position : 15   14.....11  10   9    8    7    6   5    4   3.....0
Champ    : QR |  OPCODE  | AA | TC | RD | RA | Z | AD | CD | RCODE
Taille   :  1 |     4    |  1 |  1 |  1 |  1 | 1 |  1 |  1 |   4
```

| Champ | Taille | Rôle |
|:------|-------:|:-----|
| `QR` | 1 bit | Indique s'il s'agit d'une requête ou d'une réponse |
| `OPCODE` | 4 bits | Indique le type d'opération DNS |
| `AA` | 1 bit | Indique une réponse faisant autorité |
| `TC` | 1 bit | Indique que le message a été tronqué |
| `RD` | 1 bit | Indique que le client demande la récursion |
| `RA` | 1 bit | Indique que le serveur propose la récursion |
| `Z` | 1 bit | Bit encore réservé, qui doit rester à zéro |
| `AD` | 1 bit | Indique des données authentifiées par DNSSEC |
| `CD` | 1 bit | Demande la désactivation de la validation DNSSEC |
| `RCODE` | 4 bits | Indique le résultat ou l'erreur de la réponse |

### Valeurs principales de `RCODE`

| Binaire | Décimal | Nom | Signification |
|:-------:|--------:|:----|:--------------|
| `0000` | 0 | `NOERROR` | Aucune erreur signalée |
| `0001` | 1 | `FORMERR` | Le serveur ne peut pas interpréter la requête |
| `0010` | 2 | `SERVFAIL` | Le serveur a rencontré un problème interne |
| `0011` | 3 | `NXDOMAIN` | Le nom demandé n'existe pas |
| `0100` | 4 | `NOTIMP` | L'opération demandée n'est pas implémentée |
| `0101` | 5 | `REFUSED` | Le serveur refuse l'opération |

## Extraire un champ avec un masque

Un masque binaire agit comme un pochoir. L'opérateur `&` ne conserve que les
positions où le masque contient un `1`.

```text
flags  : xxxx xxxx xxxx xxxx
masque : 0000 0001 0000 0000
         ------------------- &
résultat: 0000 000x 0000 0000
```

Le masque de `RD` est `0x0100` :

```ts
const recursionDesired = (flags & 0x0100) !== 0;
```

Si le résultat du `&` est différent de zéro, le bit est activé.

Pour un champ de plusieurs bits, on applique d'abord le masque, puis on déplace
les bits vers la droite avec `>>>` :

```ts
const opcode = (flags & 0x7800) >>> 11;
const responseCode = flags & 0x000f;
```

`OPCODE` commence au bit 11, donc il faut le décaler de 11 positions. `RCODE`
se trouve déjà tout à droite, donc aucun décalage n'est nécessaire.

## Masques des flags DNS

| Champ | Position | Masque | Décalage |
|:------|:---------|:-------|----------:|
| `QR` | bit 15 | `0x8000` | 15 |
| `OPCODE` | bits 14 à 11 | `0x7800` | 11 |
| `AA` | bit 10 | `0x0400` | 10 |
| `TC` | bit 9 | `0x0200` | 9 |
| `RD` | bit 8 | `0x0100` | 8 |
| `RA` | bit 7 | `0x0080` | 7 |
| `Z` | bit 6 | `0x0040` | 6 |
| `AD` | bit 5 | `0x0020` | 5 |
| `CD` | bit 4 | `0x0010` | 4 |
| `RCODE` | bits 3 à 0 | `0x000f` | 0 |

## Méthode à appliquer pendant une analyse

Pour analyser manuellement une valeur comme `0x1234` :

1. convertir chaque chiffre hexadécimal en quatre bits ;
2. concaténer les groupes pour obtenir les 16 bits ;
3. placer les séparateurs selon la structure DNS moderne ;
4. relever la valeur de chaque champ ;
5. convertir les champs de plusieurs bits en décimal ;
6. consulter la signification de la valeur dans la spécification DNS.

```text
hexadécimal
    ↓
16 bits
    ↓
découpage QR | OPCODE | AA | TC | RD | RA | Z | AD | CD | RCODE
    ↓
valeurs numériques
    ↓
signification protocolaire
```

## Pièges à éviter

- Ne pas confondre la **valeur d'un bit** avec sa **position**. Le bit 8 possède
  la valeur décimale `256`, soit le masque `0x0100`.
- Ne pas lire les groupes hexadécimaux comme les champs DNS. Les chiffres
  hexadécimaux regroupent les bits par quatre, alors que les champs DNS ont des
  tailles différentes.
- Ne pas oublier les zéros au début. `1` et `0001` ont la même valeur, mais les
  zéros sont nécessaires pour visualiser correctement un champ de quatre bits.
- `RD = 1` signifie que la récursion est demandée. `RA = 1` signifie qu'elle est
  disponible. Cela ne prouve pas que la résolution récursive a été effectuée.
- Les octets DNS sont lus en **big-endian** : l'octet de poids fort arrive en
  premier sur le réseau.

## Mini-exercices

### Exercice 1

Convertir `0x3F` en binaire.

### Exercice 2

Convertir `1101` en décimal et en hexadécimal.

### Exercice 3

Découper cette valeur sans encore l'interpréter :

```text
FLAGS = 0000 0010 0000 0011
```

avec :

```text
QR | OPCODE | AA | TC | RD | RA | Z | AD | CD | RCODE
```
