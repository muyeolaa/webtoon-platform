// // 1. 요청 보내기 (기존의 헤더 설정 유지)
// ceonst { data } = await firstValueFrom(
//   this.httpService.gt(url, {
//     headers: {
//       'Referer': 'https://webtoon.kakao.com/',
//       'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
//     },
//   }),
// );

// // 2. 🔍 여기가 핵심입니다! 콘솔(Terminal)에 찍히는 내용을 확인하세요.
// // 데이터가 너무 길면 잘릴 수 있으니 앞부분 2000자 정도를 확인해봅니다.
// this.logger.debug('================ [카카오 데이터 구조 시작] ================');
// this.logger.debug(JSON.stringify(data).substring(0, 2000));
// this.logger.debug('================ [카카오 데이터 구조 끝] ==================');

// // 3. 일단 아래는 임시로 두시고, 콘솔에 찍힌 로그 내용을 저에게 알려주세요!
// const rawWebtoons = data.data?.list || data.list || [];