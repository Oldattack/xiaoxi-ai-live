小汐 AI 直播平台 OBS 两套配置模板
================================

profiles\小汐-横屏   画布 1920x1080
profiles\小汐-竖屏   画布 1080x1920
scenes\小汐-横屏.json
scenes\小汐-竖屏.json

平台第一次切横/竖屏时，会检查客户 OBS 里是否已有这两套；
没有就从这里复制到：

  %APPDATA%\obs-studio\basic\profiles\
  %APPDATA%\obs-studio\basic\scenes\

不会覆盖客户已有的同名配置。