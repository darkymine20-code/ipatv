/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MediaItem, Season, Episode } from './types';

// Let's create a list of 15 TV Shows with predefined details, seasons, and episodes
export const INITIAL_SHOWS: MediaItem[] = [
  {
    id: 66732,
    type: 'show',
    title: 'Stranger Things',
    posterPath: 'https://image.tmdb.org/t/p/w500/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/56v2KjBlU4XaOv9rVYEQypROD7P.jpg',
    overview: 'When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl.',
    releaseDate: '2016-07-15',
    genres: ['Sci-Fi & Fantasy', 'Drama', 'Mystery'],
    rating: 8.6,
    runtime: 50,
    seasonsCount: 5,
    episodesCount: 42,
    inWatchlist: true,
    isFavorite: true,
    userRating: 5,
    completed: false,
    lastWatchedAt: '2026-07-04T12:00:00Z', // 5 days ago (Watch Next)
  },
  {
    id: 1396,
    type: 'show',
    title: 'Breaking Bad',
    posterPath: 'https://image.tmdb.org/t/p/w500/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
    overview: 'Walter White, a chemistry teacher, discovers he has cancer and decides to get into the meth-making business to repay his medical debts. His priorities begin to change when he partners with Jesse Pinkman.',
    releaseDate: '2008-01-20',
    genres: ['Drama', 'Crime'],
    rating: 8.9,
    runtime: 49,
    seasonsCount: 5,
    episodesCount: 62,
    inWatchlist: true,
    isFavorite: true,
    userRating: 5,
    completed: false,
    lastWatchedAt: '2026-05-15T12:00:00Z', // > 30 days ago (Have Not Watched for a While)
  },
  {
    id: 119051,
    type: 'show',
    title: 'Wednesday',
    posterPath: 'https://image.tmdb.org/t/p/w500/36xXlhEpQqVVPuiZhfoQuaY4OlA.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/iHSwvRVsRyxpX7FE7GbviaDvgGZ.jpg',
    overview: 'Wednesday Addams is sent to Nevermore Academy, a bizarre boarding school where she attempts to master her emerging psychic ability, thwart a monstrous killing spree, and solve a 25-year-old mystery.',
    releaseDate: '2022-11-23',
    genres: ['Sci-Fi & Fantasy', 'Mystery', 'Comedy'],
    rating: 8.5,
    runtime: 48,
    seasonsCount: 3,
    episodesCount: 16,
    inWatchlist: false,
    isFavorite: false,
    userRating: null,
    completed: false,
    lastWatchedAt: null, // Have Not Started
  },
  {
    id: 100088,
    type: 'show',
    title: 'The Last of Us',
    posterPath: 'https://image.tmdb.org/t/p/w500/dmo6TYuuJgaYinXBPjrgG9mB5od.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/acevLdSl5I2MK5RYAm7gwAndt1w.jpg',
    overview: 'Twenty years after modern civilization has been destroyed, Joel, a hardened survivor, is hired to smuggle Ellie, a 14-year-old girl, out of an oppressive quarantine zone.',
    releaseDate: '2023-01-15',
    genres: ['Drama', 'Sci-Fi & Fantasy', 'Action & Adventure'],
    rating: 8.6,
    runtime: 55,
    seasonsCount: 2,
    episodesCount: 16,
    inWatchlist: true,
    isFavorite: true,
    userRating: null,
    completed: false,
    lastWatchedAt: '2026-07-02T15:30:00Z', // 7 days ago (Watch Next)
  },
  {
    id: 1399,
    type: 'show',
    title: 'Game of Thrones',
    posterPath: 'https://image.tmdb.org/t/p/w500/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/2OMB0ynKlyIenMJWI2Dy9IWT4c.jpg',
    overview: 'Seven noble families fight for control of the mythical land of Westeros. Friction between the houses leads to full-scale war. All while a very ancient evil awakens in the farthest North.',
    releaseDate: '2011-04-17',
    genres: ['Sci-Fi & Fantasy', 'Drama', 'Action & Adventure'],
    rating: 8.4,
    runtime: 57,
    seasonsCount: 8,
    episodesCount: 73,
    inWatchlist: true,
    isFavorite: false,
    userRating: 4,
    completed: false,
    lastWatchedAt: '2026-04-01T10:00:00Z', // > 30 days ago (Have Not Watched for a While)
  },
  {
    id: 94997,
    type: 'show',
    title: 'House of the Dragon',
    posterPath: 'https://image.tmdb.org/t/p/w500/7V0Ebks0GgpKvQ7QbLAIdX5dos4.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/577eXC8wFQT0eUrJcgznSiFPRmk.jpg',
    overview: 'The Targaryen dynasty is at the absolute apex of its power, with more than 10 dragons under their yoke. But the seeds of its downfall are sown when King Viserys names his daughter Rhaenyra as heir.',
    releaseDate: '2022-08-21',
    genres: ['Sci-Fi & Fantasy', 'Drama', 'Action & Adventure'],
    rating: 8.4,
    runtime: 60,
    seasonsCount: 3,
    episodesCount: 26,
    inWatchlist: false,
    isFavorite: false,
    userRating: null,
    completed: false,
    lastWatchedAt: null, // Have Not Started
  },
  {
    id: 95396,
    type: 'show',
    title: 'Severance',
    posterPath: 'https://image.tmdb.org/t/p/w500/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/ixgFmf1X59PUZam2qbAfskx2gQr.jpg',
    overview: 'Mark leads a team of office workers whose memories have been surgically divided between their work and personal lives. When a mysterious colleague appears outside of work, it begins a journey to discover the truth.',
    releaseDate: '2022-02-17',
    genres: ['Sci-Fi & Fantasy', 'Drama', 'Mystery'],
    rating: 8.4,
    runtime: 47,
    seasonsCount: 3,
    episodesCount: 19,
    inWatchlist: false,
    isFavorite: false,
    userRating: null,
    completed: false,
    lastWatchedAt: null,
  },
  {
    id: 84958,
    type: 'show',
    title: 'Loki',
    posterPath: 'https://image.tmdb.org/t/p/w500/rX1wQMTKFqF0gvZyS0DDQqgnQPB.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/q3jHCb4dMfYF6ojikKuHd6LscxC.jpg',
    overview: 'After stealing the Tesseract during the events of Avengers: Endgame, an alternate version of Loki is brought to the mysterious Time Variance Authority (TVA), a bureaucratic organization.',
    releaseDate: '2021-06-09',
    genres: ['Sci-Fi & Fantasy', 'Drama', 'Action & Adventure'],
    rating: 8.2,
    runtime: 50,
    seasonsCount: 2,
    episodesCount: 12,
    inWatchlist: true,
    isFavorite: false,
    userRating: 4,
    completed: true, // Marked as completed
    lastWatchedAt: '2026-06-01T12:00:00Z',
  },
  {
    id: 76331,
    type: 'show',
    title: 'Succession',
    posterPath: 'https://image.tmdb.org/t/p/w500/z0XiwdrCQ9yVIr4O0pxzaAYRxdW.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/bcdUYUFk8GdpZJPiSAas9UeocLH.jpg',
    overview: 'The Roy family is known for controlling the biggest media and entertainment company in the world. However, their world changes when their father steps down.',
    releaseDate: '2018-06-03',
    genres: ['Drama'],
    rating: 8.3,
    runtime: 60,
    seasonsCount: 4,
    episodesCount: 39,
    inWatchlist: false,
    isFavorite: false,
    userRating: null,
    completed: false,
  },
  {
    id: 136315,
    type: 'show',
    title: 'The Bear',
    posterPath: 'https://image.tmdb.org/t/p/w500/eKfVzzEazSIjJMrw9ADa2x8ksLz.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/aJtG4txtmiRHwAAqENQHZvBs6kY.jpg',
    overview: 'A young chef from the fine dining world returns to Chicago to run his family sandwich shop after a heartbreaking death.',
    releaseDate: '2022-06-23',
    genres: ['Drama', 'Comedy'],
    rating: 8.5,
    runtime: 30,
    seasonsCount: 5,
    episodesCount: 46,
    inWatchlist: true,
    isFavorite: true,
    userRating: 5,
    completed: true, // All watched
    lastWatchedAt: '2026-06-20T12:00:00Z',
  },
  {
    id: 93405,
    type: 'show',
    title: 'Squid Game',
    posterPath: 'https://image.tmdb.org/t/p/w500/1QdXdRYfktUSONkl1oD5gc6Be0s.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/2meX1nMdScFOoV4370rqHWKmXhY.jpg',
    overview: 'Hundreds of cash-strapped players accept a strange invitation to compete in children\'s games. Inside, a tempting prize awaits with deadly high stakes.',
    releaseDate: '2021-09-17',
    genres: ['Action & Adventure', 'Drama', 'Mystery'],
    rating: 8.3,
    runtime: 50,
    seasonsCount: 3,
    episodesCount: 22,
    inWatchlist: false,
    isFavorite: false,
    userRating: null,
    completed: false,
  },
  {
    id: 76479,
    type: 'show',
    title: 'The Boys',
    posterPath: 'https://image.tmdb.org/t/p/w500/in1R2dDc421JxsoRWaIIAqVI2KE.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/n6vVs6z8obNbExdD3QHTr4Utu1Z.jpg',
    overview: 'A group of vigilantes set out to take down corrupt superheroes who abuse their superpowers and fame.',
    releaseDate: '2019-07-25',
    genres: ['Sci-Fi & Fantasy', 'Action & Adventure', 'Drama'],
    rating: 8.5,
    runtime: 60,
    seasonsCount: 5,
    episodesCount: 40,
    inWatchlist: false,
    isFavorite: false,
    userRating: null,
    completed: false,
  },
  {
    id: 126308,
    type: 'show',
    title: 'Shōgun',
    posterPath: 'https://image.tmdb.org/t/p/w500/7O4iVfOMQmdCSxhOg1WnzG1AgYT.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/6Tb87q9Tog30F5AAHh1gyDT2Vve.jpg',
    overview: 'In Japan in the year 1600, Lord Yoshii Toranaga is fighting for his life as his enemies on the Council of Regents unite against him, when a mysterious European ship is found marooned in a nearby fishing village.',
    releaseDate: '2024-02-27',
    genres: ['Drama', 'War & Politics'],
    rating: 8.7,
    runtime: 58,
    seasonsCount: 1,
    episodesCount: 10,
    inWatchlist: false,
    isFavorite: false,
    userRating: null,
    completed: false,
    lastWatchedAt: null, // Have Not Started
  },
  {
    id: 85552,
    type: 'show',
    title: 'Euphoria',
    posterPath: 'https://image.tmdb.org/t/p/w500/ypmtwojDd751Peszi62DVLytqqC.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/GN2KFXiHPVV6sIw4v2P2pqCJty.jpg',
    overview: 'A look at the troubled life of Rue Bennett, a drug-addicted teenager, and her classmates as they struggle with sex, love, and trauma.',
    releaseDate: '2019-06-16',
    genres: ['Drama'],
    rating: 8.3,
    runtime: 55,
    seasonsCount: 3,
    episodesCount: 24,
    inWatchlist: false,
    isFavorite: false,
    userRating: null,
    completed: false,
  },
  {
    id: 106379,
    type: 'show',
    title: 'Fallout',
    posterPath: 'https://image.tmdb.org/t/p/w500/c15BtJxCXMrISLVmysdsnZUPQft.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/coaPCIqQBPUZsOnJcWZxhaORcDT.jpg',
    overview: 'The story of haves and have-nots in a world in which there’s almost nothing left to have. 200 years after the apocalypse, the gentle denizens of luxury fallout shelters are forced to return to the irradiated hellscape their ancestors left behind.',
    releaseDate: '2024-04-10',
    genres: ['Sci-Fi & Fantasy', 'Action & Adventure', 'Drama'],
    rating: 8.4,
    runtime: 58,
    seasonsCount: 2,
    episodesCount: 16,
    inWatchlist: false,
    isFavorite: false,
    userRating: null,
    completed: false,
    lastWatchedAt: null, // Have Not Started
  },
];

// Let's create a list of 15 Movies with predefined details and release states
export const INITIAL_MOVIES: MediaItem[] = [
  {
    id: 693134,
    type: 'movie',
    title: 'Dune: Part Two',
    posterPath: 'https://image.tmdb.org/t/p/w500/heM4XKC0jA8fTSNe8F7oUkcJV7Z.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/eZ239CUp1d6OryZEBPnO2n87gMG.jpg',
    overview: 'Follow the mythic journey of Paul Atreides as he unites with Chani and the Fremen while on a path of revenge against the conspirators who destroyed his family.',
    releaseDate: '2024-02-27', // Released
    genres: ['Sci-Fi', 'Adventure'],
    rating: 8.2,
    runtime: 166,
    inWatchlist: true,
    isFavorite: true,
    userRating: 5,
    completed: false,
  },
  {
    id: 157336,
    type: 'movie',
    title: 'Interstellar',
    posterPath: 'https://image.tmdb.org/t/p/w500/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/2ssWTSVklAEc98frZUQhgtGHx7s.jpg',
    overview: 'The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel and conquer the vast distances involved in an interstellar voyage.',
    releaseDate: '2014-11-05', // Released
    genres: ['Sci-Fi', 'Drama', 'Adventure'],
    rating: 8.4,
    runtime: 169,
    inWatchlist: true,
    isFavorite: true,
    userRating: 5,
    completed: true, // Completed Movie
  },
  {
    id: 911916,
    type: 'movie',
    title: 'Spider-Man: Beyond the Spider-Verse',
    posterPath: 'https://image.tmdb.org/t/p/w500/9PIhQqqI6Q4a5YjwMjxvzZcPJhf.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/6yZgfrPJGhXEHD2jH7hzmRt9KpQ.jpg',
    overview: 'The conclusion to Miles Morales\' multiversal saga as he faces off against Spot and a multi-dimensional league of spider-heroes who see him as an anomaly that must be contained.',
    releaseDate: '2027-06-18', // Future / Upcoming
    genres: ['Animation', 'Action', 'Sci-Fi'],
    rating: 0.0,
    runtime: 140,
    inWatchlist: false,
    isFavorite: false,
    userRating: null,
    completed: false,
  },
  {
    id: 872585,
    type: 'movie',
    title: 'Oppenheimer',
    posterPath: 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/neeNHeXjMF5fXoCJRsOmkNGC7q.jpg',
    overview: 'The story of J. Robert Oppenheimer\'s role in the development of the atomic bomb during World War II.',
    releaseDate: '2023-07-19', // Released
    genres: ['Drama', 'History'],
    rating: 8.1,
    runtime: 180,
    inWatchlist: true,
    isFavorite: true,
    userRating: 5,
    completed: true, // Completed Movie
  },
  {
    id: 346698,
    type: 'movie',
    title: 'Barbie',
    posterPath: 'https://image.tmdb.org/t/p/w500/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/3N5QNUqS76GFYNoEayfkkJyAyTN.jpg',
    overview: 'Barbie and Ken are having the time of their lives in the colorful and seemingly perfect world of Barbie Land. However, when they get a chance to go to the real world, they soon discover the joys and perils of living among humans.',
    releaseDate: '2023-07-19', // Released
    genres: ['Comedy', 'Adventure', 'Fantasy'],
    rating: 7.1,
    runtime: 114,
    inWatchlist: false,
    isFavorite: false,
    userRating: null,
    completed: false,
  },
  {
    id: 83533,
    type: 'movie',
    title: 'Avatar: Fire and Ash',
    posterPath: 'https://image.tmdb.org/t/p/w500/bRBeSHfGHwkEpImlhxPmOcUsaeg.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/u8DU5fkLoM5tTRukzPC31oGPxaQ.jpg',
    overview: 'The third installment in the epic sci-fi franchise exploring new clans on Pandora, featuring the Ash People, a more aggressive and destructive tribe of Na\'vi.',
    releaseDate: '2026-12-18', // Future / Upcoming
    genres: ['Sci-Fi', 'Action', 'Adventure'],
    rating: 0.0,
    runtime: 160,
    inWatchlist: false,
    isFavorite: false,
    userRating: null,
    completed: false,
  },
  {
    id: 545611,
    type: 'movie',
    title: 'Everything Everywhere All at Once',
    posterPath: 'https://image.tmdb.org/t/p/w500/u68AjlvlutfEIcpmbYpKcdi09ut.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/ss0Os3uWJfQAENILHZUdX8Tt1OC.jpg',
    overview: 'An aging Chinese immigrant is swept up in an insane adventure, where she alone can save the world by exploring other universes connecting with the lives she could have led.',
    releaseDate: '2022-03-24', // Released
    genres: ['Action', 'Sci-Fi', 'Comedy'],
    rating: 7.8,
    runtime: 139,
    inWatchlist: false,
    isFavorite: false,
    userRating: null,
    completed: false,
  },
  {
    id: 414906,
    type: 'movie',
    title: 'The Batman',
    posterPath: 'https://image.tmdb.org/t/p/w500/74xTEgt7R36Fpooo50r9T25onhq.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/IYUD7rAIXzBM91TT3Z5fILUS7n.jpg',
    overview: 'In his second year of fighting crime, Batman uncovers corruption in Gotham City that connects to his own family while facing a serial killer known as the Riddler.',
    releaseDate: '2022-03-01', // Released
    genres: ['Crime', 'Mystery', 'Thriller'],
    rating: 7.7,
    runtime: 176,
    inWatchlist: false,
    isFavorite: false,
    userRating: null,
    completed: false,
  },
  {
    id: 438631,
    type: 'movie',
    title: 'Dune',
    posterPath: 'https://image.tmdb.org/t/p/w500/gDzOcq0pfeCeqMBwKIJlSmQpjkZ.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/zRKQW58MBEY078AxkHxEJzUskCl.jpg',
    overview: 'Paul Atreides, a brilliant and gifted young man born into a great destiny beyond his understanding, must travel to the most dangerous planet in the universe to ensure the future of his family and his people.',
    releaseDate: '2021-09-15', // Released
    genres: ['Sci-Fi', 'Adventure'],
    rating: 7.8,
    runtime: 155,
    inWatchlist: true,
    isFavorite: false,
    userRating: 4,
    completed: true,
  },
  {
    id: 27205,
    type: 'movie',
    title: 'Inception',
    posterPath: 'https://image.tmdb.org/t/p/w500/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg',
    overview: 'Cobb, a skilled thief who commits corporate espionage by infiltrating the subconscious of his targets, is offered a chance to regain his old life as payment for a task considered to be impossible: inception.',
    releaseDate: '2010-07-15', // Released
    genres: ['Action', 'Sci-Fi', 'Thriller'],
    rating: 8.4,
    runtime: 148,
    inWatchlist: false,
    isFavorite: true,
    userRating: 5,
    completed: true,
  },
  {
    id: 1003598,
    type: 'movie',
    title: 'Avengers: Secret Wars',
    posterPath: 'https://image.tmdb.org/t/p/w500/f0YBuh4hyiAheXhh4JnJWoKi9g5.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/rytc6Lf4447C0CDncwFa4gxe0vY.jpg',
    overview: 'The massive culmination of the Marvel Cinematic Universe\'s Multiverse Saga, bringing together heroes from across realities to face an existential threat to all creation.',
    releaseDate: '2027-05-07', // Future / Upcoming
    genres: ['Action', 'Sci-Fi', 'Adventure'],
    rating: 0.0,
    runtime: 180,
    inWatchlist: true,
    isFavorite: false,
    userRating: null,
    completed: false,
  },
  {
    id: 558449,
    type: 'movie',
    title: 'Gladiator II',
    posterPath: 'https://image.tmdb.org/t/p/w500/2cxhvwyEwRlysAmRH4iodkvo0z5.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/tOqIwliWMovSIZ9DyvHcHI7p2im.jpg',
    overview: 'Years after witnessing the death of the revered hero Maximus at the hands of his uncle, Lucius is forced to enter the Colosseum after his home is conquered by the tyrannical Emperors who now lead Rome with an iron fist.',
    releaseDate: '2024-11-05', // Released
    genres: ['Action', 'Drama', 'Adventure'],
    rating: 6.8,
    runtime: 148,
    inWatchlist: false,
    isFavorite: false,
    userRating: null,
    completed: false,
  },
  {
    id: 1022789,
    type: 'movie',
    title: 'Inside Out 2',
    posterPath: 'https://image.tmdb.org/t/p/w500/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/p5ozvmdgsmbWe0H8Xk7Rc8SCwAB.jpg',
    overview: 'Teenager Riley\'s mind headquarters is undergoing a sudden demolition to make room for something entirely unexpected: new Emotions! Joy, Sadness, Anger, Fear and Disgust aren\'t sure how to feel when Anxiety shows up.',
    releaseDate: '2024-06-11', // Released
    genres: ['Animation', 'Family', 'Comedy'],
    rating: 7.6,
    runtime: 96,
    inWatchlist: false,
    isFavorite: false,
    userRating: null,
    completed: false,
  },
  {
    id: 569094,
    type: 'movie',
    title: 'Spider-Man: Across the Spider-Verse',
    posterPath: 'https://image.tmdb.org/t/p/w500/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/9xfDWXAUbFXQK585JvByT5pEAhe.jpg',
    overview: 'After reuniting with Gwen Stacy, Brooklyn\'s full-time, friendly neighborhood Spider-Man is catapulted across the Multiverse, where he encounters the Spider-Society, a team of Spider-People charged with protecting the Multiverse\'s very existence.',
    releaseDate: '2023-05-31', // Released
    genres: ['Animation', 'Action', 'Sci-Fi'],
    rating: 8.4,
    runtime: 140,
    inWatchlist: false,
    isFavorite: false,
    userRating: null,
    completed: false,
  },
  {
    id: 533535,
    type: 'movie',
    title: 'Deadpool & Wolverine',
    posterPath: 'https://image.tmdb.org/t/p/w500/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/cOoVcVQ3i1m5b2xtqKBtoTSbxC1.jpg',
    overview: 'A listless Wade Wilson toils in civilian life with his days as the morally flexible mercenary, Deadpool, behind him. But when his homeworld faces an existential threat, he must reluctantly suit-up again with an even more reluctant Wolverine.',
    releaseDate: '2024-07-24', // Released
    genres: ['Action', 'Comedy', 'Sci-Fi'],
    rating: 7.7,
    runtime: 127,
    inWatchlist: false,
    isFavorite: false,
    userRating: null,
    completed: false,
  },
];

// Pre-create some season/episode lists for the core shows to support offline functionality instantly!
export function getPredefinedSeasons(showId: number): Season[] {
  const seasons: Season[] = [];
  let numSeasons = 2;
  
  if (showId === 66732) numSeasons = 4; // Stranger Things
  else if (showId === 1396) numSeasons = 5; // Breaking Bad
  else if (showId === 1399) numSeasons = 8; // Game of Thrones
  
  for (let s = 1; s <= numSeasons; s++) {
    const episodes: Episode[] = [];
    // let's add 8 episodes per season
    for (let e = 1; e <= 8; e++) {
      episodes.push({
        id: showId * 1000 + s * 100 + e,
        season: s,
        episode: e,
        title: getPredefinedEpisodeTitle(showId, s, e),
        airDate: getPredefinedEpisodeAirdate(showId, s, e),
        overview: `Chapter ${e} of Season ${s} of this incredible show. Experience the thrilling character drama and action.`,
        watched: false, // will be overwritten by user's localStorage states
        voteAverage: getPredefinedEpisodeRating(showId, s, e),
      });
    }
    
    seasons.push({
      id: showId * 1000 + s,
      seasonNumber: s,
      name: `Season ${s}`,
      episodes,
    });
  }
  
  return seasons;
}

function getPredefinedEpisodeTitle(showId: number, s: number, e: number): string {
  if (showId === 66732) {
    const titles: Record<string, string> = {
      '1-1': 'The Vanishing of Will Byers', '1-2': 'The Weirdo on Maple Street', '1-3': 'Holly, Jolly', '1-4': 'The Body',
      '1-5': 'The Flea and the Acrobat', '1-6': 'The Monster', '1-7': 'The Bathtub', '1-8': 'The Upside Down',
      '2-1': 'MADMAX', '2-2': 'Trick or Treat, Freak', '2-3': 'The Pollywog', '2-4': 'Will the Wise',
    };
    return titles[`${s}-${e}`] || `Stranger Chapter ${e}`;
  }
  if (showId === 1396) {
    const titles: Record<string, string> = {
      '1-1': 'Pilot', '1-2': 'Cat\'s in the Bag...', '1-3': '...And the Bag\'s in the River', '1-4': 'Cancer Man',
      '1-5': 'Gray Matter', '1-6': 'Crazy Handful of Nothin\'', '1-7': 'A No-Rough-Stuff-Type Deal',
    };
    return titles[`${s}-${e}`] || `Breaking Episode ${e}`;
  }
  return `Episode ${e}`;
}

function getPredefinedEpisodeAirdate(showId: number, s: number, e: number): string {
  if (showId === 66732 && s === 5) {
    // Stranger Things Season 5 (released 2025 in this timeline)
    return `2025-06-${10 + e}`;
  }
  
  if (showId === 100088 && s === 2) {
    // The Last of Us Season 2 (released 2025 in this timeline)
    return `2025-02-${10 + e}`;
  }
  
  // Past dates default
  return `2022-06-${10 + e < 10 ? '0' + (10 + e) : 10 + e}`;
}

export function getPredefinedEpisodeRating(showId: number, s: number, e: number): number {
  if (showId === 1396) { // Breaking Bad
    if (s === 5 && (e === 8 || e === 7 || e === 6)) return 9.9;
    return Number((8.7 + ((s * 7 + e * 11) % 13) / 10).toFixed(1));
  }
  if (showId === 66732) { // Stranger Things
    if (s === 4 && e === 7) return 9.6;
    return Number((8.1 + ((s * 5 + e * 9) % 14) / 10).toFixed(1));
  }
  if (showId === 1399) { // Game of Thrones
    if (s === 8) {
      return Number((5.5 + ((e * 3) % 15) / 10).toFixed(1));
    }
    if (s === 6 && (e === 7 || e === 8)) return 9.9;
    return Number((8.3 + ((s * 4 + e * 8) % 15) / 10).toFixed(1));
  }
  return Number((7.0 + ((showId + s * 3 + e * 7) % 25) / 10).toFixed(1));
}

// Generate the initial upcoming episode timeline for tracking
export interface UpcomingEpisode {
  showId: number;
  showTitle: string;
  showPoster: string;
  episodeId: number;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string;
  airDate: string;
  airTime: string;
  countdown: string;
}

export function getUpcomingEpisodesTimeline(
  allShows: MediaItem[],
  watchedEpisodes?: Record<number, Record<string, boolean>>
): UpcomingEpisode[] {
  const timeline: UpcomingEpisode[] = [];
  const currentDate = new Date();

  // We filter shows that are in the watchlist and not completed
  const watchlistShows = allShows;

  watchlistShows.forEach(show => {
    // 2. Scan real upcoming episodes from TMDB cached seasons!
    if (show.seasons && show.seasons.length > 0) {
      const futureEpisodes: { episode: Episode; seasonNumber: number }[] = [];
      show.seasons.forEach(season => {
        if (season.episodes && season.episodes.length > 0) {
          season.episodes.forEach(ep => {
            if (ep.airDate) {
              const epDate = new Date(ep.airDate);
              currentDate.setHours(0, 0, 0, 0);
              
              if (!isNaN(epDate.getTime()) && epDate >= currentDate) {
                // Check if already watched
                const showWatched = watchedEpisodes?.[show.id] || {};
                const epKey = `S${season.seasonNumber}E${ep.episode}`;
                if (!showWatched[epKey]) {
                  futureEpisodes.push({
                      episode: ep,
                      seasonNumber: season.seasonNumber,
                  });
                }
              }
            }
          });
        }
      });

      if (futureEpisodes.length > 0) {
        // Sort them chronologically
        futureEpisodes.sort((a, b) => a.episode.airDate.localeCompare(b.episode.airDate));
        
        // Take the first 2 future episodes
        futureEpisodes.slice(0, 2).forEach(item => {
          const ep = item.episode;
          const airDateObj = new Date(ep.airDate);
          const diffTime = airDateObj.getTime() - currentDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          let countdownStr = `In ${diffDays} days`;
          if (diffDays === 0) countdownStr = 'Today';
          else if (diffDays === 1) countdownStr = 'Tomorrow';

          timeline.push({
            showId: show.id,
            showTitle: show.title,
            showPoster: show.posterPath,
            episodeId: ep.id || (show.id * 1000 + item.seasonNumber * 100 + ep.episode),
            seasonNumber: item.seasonNumber,
            episodeNumber: ep.episode,
            episodeTitle: ep.title,
            airDate: ep.airDate,
            airTime: '21:00',
            countdown: countdownStr,
          });
        });
        return;
      }
      
      // If seasons are loaded but there are no future episodes, do NOT add any upcoming episodes for this show
      return;
    }
  });

  // Sort upcoming chronologically by airDate
  return timeline.sort((a, b) => new Date(a.airDate).getTime() - new Date(b.airDate).getTime());
}
