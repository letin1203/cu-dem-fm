import { prisma } from './prisma';

export const AVATAR_PATHS = [
  '/avatars/01-side-eye.png', '/avatars/01-sleepy.png',
  '/avatars/02-excited.png', '/avatars/02-worried.png',
  '/avatars/03-masked.png', '/avatars/03-unimpressed.png',
  '/avatars/04-laughing.png', '/avatars/04-shouting.png',
  '/avatars/05-popcorn.png', '/avatars/05-smile.png',
  '/avatars/06-heart.png', '/avatars/06-thinking.png',
  '/avatars/07-bandana.png', '/avatars/07-gesture.png',
  '/avatars/08-crying.png', '/avatars/08-smirk.png',
  '/avatars/09-annoyed.png', '/avatars/09-laughing-tears.png',
  '/avatars/10-cool.png', '/avatars/10-sunglasses.png',
  '/avatars/11-kiss.png', '/avatars/11-score-10.png',
  '/avatars/12-confused.png', '/avatars/12-loser.png',
] as const;

export const getRandomAvatar = (): string =>
  AVATAR_PATHS[Math.floor(Math.random() * AVATAR_PATHS.length)];

export const assignMissingPlayerAvatars = async (): Promise<number> => {
  const players = await prisma.player.findMany({
    where: { OR: [{ avatar: null }, { avatar: '' }] },
    select: { id: true },
  });
  await Promise.all(players.map(player => prisma.player.update({
    where: { id: player.id },
    data: { avatar: getRandomAvatar() },
  })));
  return players.length;
};
