export const debounce = (func: Function, ms: number): Function => {
  let timeout: NodeJS.Timeout | null;

	return function wrapper(this: Function, ...args: any[]) {
    const context = this;

		var later = () => {
			timeout = null;
			func.apply(context, args);
		};

    if (timeout) {
      clearTimeout(timeout);
    }
		timeout = setTimeout(later, ms);
	};
};