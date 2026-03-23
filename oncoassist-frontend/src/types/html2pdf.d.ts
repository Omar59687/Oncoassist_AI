declare module 'html2pdf.js' {
  interface Options {
    margin?: number | number[];
    filename?: string;
    image?: {
      type?: string;
      quality?: number;
    };
    html2canvas?: {
      scale?: number;
    };
    jsPDF?: {
      orientation?: string;
      unit?: string;
      format?: string;
    };
  }

  interface Html2Pdf {
    set(options: Options): Html2Pdf;
    from(element: HTMLElement): Html2Pdf;
    save(): void;
    output?(type: string): any;
  }

  function html2pdf(): Html2Pdf;
  export default html2pdf;
}
