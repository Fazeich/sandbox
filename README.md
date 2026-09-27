# Исток — первобытная песочница от первого лица

Бесконечный процедурный мир, две пустые руки и развитие через действия с материалами. Без заданий, подсказок, дерева рецептов и конечной цели. Новая жизнь создаёт новый случайный мир; продолжение сохраняет его географию, изменения, вещи и состояние персонажа. Предыдущая автомобильная экспедиция доступна по `/expedition`; Snake и Letter Rain сохранены.

```bash
npm install
npm run start  # solo and room server, http://localhost:3000/portfolio/
npm run coop   # same game/server exposed to your local network
```

**Кооператив до четырёх игроков:** «Вместе» → «Создать мир», затем передайте код комнаты или ссылку из меню паузы. Все игроки открывают один сервер; на другом компьютере используйте LAN IP хоста вместо localhost. Мир, животные и лежащие предметы общие; руки, инвентарь, практика и физиология у каждого свои. Сервер проверяет действия и исключает двойной подбор. При выходе вещи остаются на земле. Пустая комната живёт 30 минут; перезапуск сервера удаляет комнаты. Одиночное сохранение хранится отдельно в localStorage. Это прототип для друзей, без аккаунтов и постоянного публичного сервера.

**Static hosting:** solo mode works on GitHub Pages. Online rooms need the project's Vite development/preview server; the static deploy does not create an internet multiplayer backend. `npm run preview -- --config configs/vite.config.ts` also mounts the room API alongside the build.

**Текущий игровой срез:** раскалывание орехов, обработка камня до чоппера, заострение палки, рубка, сбор яблок с редких крупных дубов, охота и разделка, плетение шнура, изготовление сумки и рюкзака. Практика растёт от работы. Сумка расширяет быстрые ячейки с 2 до 9; рюкзак добавляет отдельные 21. Это упрощённая симуляция первых инструментов, а не завершённая модель человеческой истории: огонь, строительство жилищ, обработка почвы и дальнейшие технологии пока не реализованы.

**Физиология:** красный диск здоровья, нижняя оранжевая дуга сытости, верхняя синяя дуга воды, внешнее жёлтое кольцо общих сил. Ходьба не расходует силы; бег и работа расходуют медленно. Сон и еда восстанавливают. Истощение ограничивает действия, замедляет ходьбу и через некоторое время повреждает здоровье. Миникарта выключена по умолчанию. Смерть необратима для персонажа: всё, что он нёс, остаётся лежать у тела как общий лут; «Родиться заново» даёт нового персонажа с пустыми руками и нулевой практикой в том же мире. План развития: `docs/ROADMAP.md`.

Управление для разработки (в игровом интерфейсе подсказок нет): WASD — движение, мышь — взгляд, Shift — бег, Space — прыжок, E — подобрать/пить, ЛКМ — действие с объектом, ПКМ — работа предметами в руках, F — есть, Q — положить, цифры — быстрые ячейки, B/И — рюкзак, Esc — меню со сном. Если захват мыши недоступен, взгляд меняется правым перетаскиванием или стрелками. Нужны клавиатура и мышь. В сетевой комнате меню останавливает только ваш ввод, мир продолжает жить.

Мир подгружается чанками с ограниченным кешем и плавно смешанными биомами. Игровые GLB-модели берёзы, трёх дубов, яблока, оленя и камня хранятся в проекте вместе с мультяшными текстурами. Персонажи, руки и инструменты строятся процедурно. Звуки синтезируются через Web Audio. Лёгкая графика отключает тени и постобработку.

Validation: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`.

## Legacy portfolio experiments

A personal portfolio built as a set of **3D mini-games** with react-three-fiber. The games are the portfolio — they demonstrate skills through gameplay and code quality, without an explicit "skills" section.

## Pages

- **Legacy expedition** (`/expedition`) — explore a voxel valley by car, restore five beacons, or approach an arcade portal and press `E`.
- **Snake 3D** (`/snake`) — free-movement snake in a volumetric arena: break protected food with a boost ram and collect flying shards.
- **Letter Rain** (`/letters`) — type anywhere; characters fall as 3D blocks with simple stacking physics.

## Controls

| Page | Control |
|---|---|
| Legacy expedition | `WASD` / arrows to drive, `Space` handbrake, `F` restore beacon, `E` enter arcade, `Esc` pause |
| Snake | Mouse (`LMB`) or `WASD` to steer, `Space` boost, `Esc` pause |
| Letter Rain | Type to drop letters, `Esc` or `← Назад` to return |

## Tech Stack

- **React 18** + **Vite** + **TypeScript** (strict)
- **Three.js** + **react-three-fiber**, **drei**, **@react-three/postprocessing** (Bloom, Vignette)
- **Effector** — discrete game events
- **styled-components** — DOM overlays and theming
- **Vitest** — unit tests for physics and stores
- **ESLint** (flat config) + `tsc`

## Getting Started

```bash
npm install
npm run start      # dev server → http://localhost:3000/portfolio/
```

Scripts: `npm run build`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run deploy` (GitHub Pages).

## Links

- [Telegram](https://t.me/samsyaaa)
- [GitHub](https://github.com/fazeich)
- Email: vladislavchenko@inbox.ru
