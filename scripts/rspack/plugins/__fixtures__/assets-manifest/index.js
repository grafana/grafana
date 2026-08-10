import './styles.css';
import imageUrl from './image.png';

console.log(imageUrl);

import(/* webpackChunkName: "lazy" */ './lazy.js').then((module) => {
  console.log(module.value);
});
