(function($){
	var methods = {
		public: {
			init: function(params){
				var master = this;

				$(master).data('jigsaw', $.extend({
					register: new Object,
					ready: [],
					loadingCounter: 0
				}, params));

				if(params.preload != undefined)
					params.preload();

				if(params.postload != undefined)
					$(master).data('jigsaw').ready.push(params.postload);

                methods.private.createBaseJSObject.apply(master);
                
				var chain = this.each(function(){
					$.each(params.pieces, function(pieceName, containers){
						$(containers).each(function(){
							methods.private.fetchPiece.apply(master, [this, pieceName]);
						});
					});
				});

				setTimeout(function(){ methods.private.ready.apply(master); }, 50);

				return chain;
			}
		},
		private: {
			fetchPiece: function(container, pieceName){
				var data = $(this).data('jigsaw');
				var master = this;

				var spinner = $('<table/>').css('margin', '25px')
					.append($('<tr/>')
					.append($('<td/>').css({'text-align': 'center', 'vertical-align': 'middle'})
					.append($('<img/>').attr({'src': data.spinner, 'alt': 'Loading...'})
				)));

				if($(container).height() != 0)
					spinner = $(spinner).css('height', '100%');
				if($(container).width() != 0)
					spinner = $(spinner).css('width', '100%');

				$(container).html(spinner);

				data.loadingCounter++;
				$.ajax({
				    url: data.pieceurl,
				    data: ({
					    'piece': pieceName,
				    }),
				    type: 'POST',
				    dataType: 'xml',
				    success: function (xml) {
                        $(xml).find('piece').each(function(){
                            var piece = {
						        'name':  $(this).attr('name'),
						        'html': $(this).find('html').text(),
						        'css': $(this).find('css').text(),
						        'js': $(this).find('js').text()
					        };

					        methods.private.loadPiece.apply(master, [container, piece]);
					        data.loadingCounter--;
                        });
				    },
				    error: function (XMLHttpRequest, textStatus, errorThrown) {
					    alert(errorThrown);
				    }
				});
			},
			loadPiece: function(container, piece){
				var data = $(this).data('jigsaw');
				var id, pid, containerid, jsid;

				id = $(container).attr('id');
				if(id == undefined){
					pid = methods.private.generateRandomId(data.prefix);
					containerid = data.prefix + '_phtml_' + pid;
					jsid = data.prefix + '_pjs_' + pid;

					$(container).attr('id', containerid);
				}
				else{
					pid = id;
					containerid = pid;
					jsid = data.prefix + '_pjs_' + pid;
				}

				var selectors = /([^{,\n]+)([{,])(?!i[.\s]*;)/gm;
				var namespace = '#' + containerid + ' $1$2';
				piece['css'] = piece['css'].replace(selectors, namespace);

				var stylesid = data.prefix + '-styles';
				if($('#' + stylesid).length == 0)
					$('<style/>').attr('type', 'text/css').attr('id', stylesid).appendTo('head');
				
				$('#' + stylesid).append(piece['css']);

				$(container).html(piece['html']);

                var jso = null;
				piece['js'] = $.trim(piece['js']);
				if(piece['js'].length > 0){
                    methods.private.createJSObject(jsid, piece['js']);
                    
					jso = eval(jsid + '.init()');
					jso.name = piece['name'];
					jso.register = data.register;
					jso.pid = pid;
					jso.container = $(container);

					if(jso.ready != undefined)
						data.ready.push(jso);

					if(jso.load != undefined){
                        data.loadingCounter++;
                        jso.loaded = function(){data.loadingCounter--;}
						jso.load();
                    }
				}

				if(data.register[piece['name']] == undefined)
					data.register[piece['name']] = [];

				data.register[piece['name']].push({
                    'containerid': containerid,
                    'jso': jso
                });
			},
			ready: function(){
				var master = this;
				var data = $(this).data('jigsaw');
				if(data.loadingCounter == 0){
					var readys = Array.prototype.slice.call(data.ready).reverse();
					$.each(readys, function(){
						if(this.ready != undefined) this.ready();
						else this();
					});
				}
				else
					setTimeout(function(){ methods.private.ready.apply(master); }, 50);
			},
			generateRandomId: function(prefix){
				var id = null;
				while(id == null || $('#' + prefix + '_did_' + id).length > 0)
					id = Math.random().toString(36).substring(7);
				return id;
			},
            createBaseJSObject: function(){
                var methodurl = $(this).data('jigsaw').methodurl;
                window.JigsawBaseJSObject = {
				    init: function(){
                        return this;
                    },
				    getFunctionClosure: function(fn,params){
                        var t = this;
                        return function(){fn.apply(t,params);}
                    },
                    callServerMethod: function(name, params, successCallback){
                        $.ajax({
                            url: methodurl + (methodurl.indexOf('?') == -1 ? '?' : '&') + 'piece=' + this.name + '&method=' + name,
				            data: params,
				            type: 'POST',
				            dataType: 'xml',
				            success: successCallback
                        });
                    }
				};
            },
			createJSObject: function(jsid, js){
				var jso = 'var ' + jsid + ' = $.extend({\n';
				jso += js;
				jso += '\n}, window.JigsawBaseJSObject);\n';
				
                methods.private.appendJSObject(jso);
			},
            appendJSObject: function(jso){
                var script = document.createElement('script');
				script.type = 'text/javascript';
				script.text = jso;
				document.body.appendChild(script);
            }
		}
	};

	$.fn.jigsaw = function(method){
		if(methods.public[method])
			return methods.public[method].apply(this, Array.prototype.slice.call(arguments, 1));
		else if (typeof method === 'object' || !method){
			arguments[0] = $.extend(true,{
				'prefix': 'jigsaw',
				'pieceurl': '/jigsaw.aspx?action=getpiece',
				'methodurl': '/jigsaw.aspx?action=callmethod',
				'spinner': '/images/spinner.gif'
			}, arguments[0]);

			return methods.public.init.apply(this, arguments);
		}
		else
			$.error('Method ' +  method + ' does not exist in jigsaw');
	};
})(jQuery);
