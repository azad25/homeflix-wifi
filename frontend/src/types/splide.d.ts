declare module '@splidejs/react-splide' {
    import { Component } from 'react';
    export class Splide extends Component<any, any> {
        go(index: number): void;
        sync(splide: any): void;
        index: number;
        splide: any;
    }
    export class SplideSlide extends Component<any, any> { }
}
