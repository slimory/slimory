declare module 'opencc-js' {
    export interface ConverterOptions {
        from: 'cn' | 'tw' | 'hk' | 'jp' | 't' | 's'
        to: 'cn' | 'tw' | 'hk' | 'jp' | 't' | 's'
    }

    export type ConverterFunction = (text: string) => string

    export function Converter(options: ConverterOptions): ConverterFunction
}

