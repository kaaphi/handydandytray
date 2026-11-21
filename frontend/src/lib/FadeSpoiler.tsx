import { Spoiler, type SpoilerProps } from '@mantine/core';
import classes from './FadeSpoiler.module.css';

//uses CSS to create a gradient fade to transparent on the contents when collapsed
export const FadeSpoiler = (props: SpoilerProps) => {
  return <Spoiler classNames={classes} {...props} />;
}